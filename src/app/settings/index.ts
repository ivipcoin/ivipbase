import { LocalServer, ServerInitialSettings, ServerSettings, isPossiblyServer } from "../../server";
import { IvipBaseSettings as BrowserSettings, InitialServerEmailSettings, ServerEmailSettings as BrowserEmailSettings, EmailRequest } from "./browser";
import NodeMailer from "nodemailer";
import juice from "juice";
import type { RulesData } from "../../server/services/rules";

type TemplateMailerActionsValue = string | number | boolean | TemplateMailerActions | (() => string | number | boolean);

interface TemplateMailerActions {
	[k: string]: TemplateMailerActionsValue;
}

const getTemplateValueBy = (str: string, actions: TemplateMailerActions): string => {
	str = String(!str || String(str).trim() === "" ? "" : str);
	actions = !actions || typeof actions !== "object" ? {} : actions;
	const expression = /\{\{(([a-z0-9_\-]+\.?)+)\}\}/i;

	if (expression.test(str) !== true) {
		return str;
	}

	let path = (str ?? "").match(expression)?.[1];

	if (path) {
		let value: TemplateMailerActionsValue | null = actions;

		path.split(".").forEach((key, i) => {
			value = value && typeof value === "object" && key in value ? value[key] : null;
		});

		value = typeof value === "function" ? (value as any)() : ["string", "number", "boolean"].includes(typeof value) ? value : "[[ERROR]]";
		str = str.replace(new RegExp("{{" + path + "}}", "gi"), (value as any) ?? "");
	}

	return getTemplateValueBy(str, actions);
};

class ServerEmailSettings extends BrowserEmailSettings {
	protected transporter: NodeMailer.Transporter;
	readonly prepareModel: (request: EmailRequest) => {
		title: string;
		subject: string;
		message: string;
	} = (request) => {
		let title: string = "iVipBase";
		let subject: string = "";
		let message: string = "";

		try {
		} catch {}

		return { title, subject, message };
	};

	constructor(options: InitialServerEmailSettings) {
		super(options);

		if (typeof options.prepareModel === "function") {
			this.prepareModel = options.prepareModel;
		}

		this.transporter = NodeMailer.createTransport({
			host: this.server.host,
			port: this.server.port,
			secure: this.server.secure,
			auth: {
				user: this.server.user,
				pass: this.server.pass,
			},
		});
	}

	/** Função a ser chamada quando um e-mail precisa ser enviado */
	async send(request: EmailRequest): Promise<void> {
		const { title, subject, message } = this.prepareModel(request);

		await this.transporter.sendMail({
			priority: "high",
			from: `${title} <${this.server.user}>`,
			to: request.user.email,
			subject: subject,
			text: subject,
			html: juice(getTemplateValueBy(message, request as any), { removeStyleTags: false }),
		});
	}
}

interface AppServerSettings extends ServerInitialSettings<LocalServer> {
	email: InitialServerEmailSettings;
}

interface DatabaseSettings {
	name: string;
	description?: string;
	rulesData?: RulesData;
}

export type IvipBaseSettingsOptions = Partial<IvipBaseSettings & ServerInitialSettings<LocalServer> & AppServerSettings>;

export class IvipBaseSettings extends BrowserSettings {
	readonly isServer: boolean = false;
	readonly isValidClient: boolean = false;

	readonly dbname: string | string[] = "root";
	readonly database: DatabaseSettings | DatabaseSettings[] = {
		name: "root",
		description: "iVipBase database",
	};

	readonly server?: ServerSettings;

	/**
	 * Configurações de e-mail que habilitam o iVipServer a enviar e-mails, por exemplo, para dar as boas-vindas a novos usuários, redefinir senhas, notificar sobre novos logins, etc.
	 */
	readonly email?: ServerEmailSettings;

	constructor(options: IvipBaseSettingsOptions = {}) {
		super(options);

		if (options.isServer && isPossiblyServer) {
			this.isServer = true;
			this.server = new ServerSettings(options);

			if (typeof options.email === "object") {
				this.email = new ServerEmailSettings(options.email);
			}

			if (Array.isArray(options.database) || typeof options.database === "object") {
				this.database = (Array.isArray(options.database) ? options.database : [options.database]).filter((o) => {
					return typeof o === "object" && typeof o.name === "string" && o.name.trim() !== "";
				});

				this.dbname = this.database.map(({ name }) => name);
				this.dbname = this.dbname.length > 0 ? this.dbname : "root";
			}
		}
	}
}
