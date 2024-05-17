import { RequestError } from "./error";

/**
 * @returns returns a promise that resolves with an object containing data and an optionally returned context
 */
export default async function request(
	method: "GET" | "POST" | "PUT" | "DELETE",
	url: string,
	options: {
		accessToken?: string | null;
		data?: any;
		dataReceivedCallback?: ((chunk: any) => void) | null;
		dataRequestCallback?: ((bytes: number) => Promise<any> | any) | null;
		context?: any;
	} = { accessToken: null, data: null, dataReceivedCallback: null, dataRequestCallback: null, context: null },
): Promise<{ context: any; data: any }> {
	let postData = options.data;
	if (typeof postData === "undefined" || postData === null) {
		postData = "";
	} else if (typeof postData === "object") {
		postData = JSON.stringify(postData);
	}
	const headers: Record<string, string> = {
		"DataBase-Context": JSON.stringify(options.context || null),
	};
	const init = {
		method,
		headers,
		body: undefined as any,
	};
	if (typeof options.dataRequestCallback === "function") {
		// Stream data to the server instead of posting all from memory at once
		headers["Content-Type"] = "text/plain"; // Prevent server middleware parsing the content as JSON

		postData = "";
		const chunkSize = 1024 * 512; // Use large chunk size, we have to store everything in memory anyway.
		let chunk: any;
		while ((chunk = await options.dataRequestCallback(chunkSize))) {
			postData += chunk;
		}
		init.body = postData;
	} else if (postData.length > 0) {
		headers["Content-Type"] = "application/json";
		init.body = postData;
	}
	if (options.accessToken) {
		headers["Authorization"] = `Bearer ${options.accessToken}`;
	}
	const request = { url, method, headers, body: undefined as any };
	const res = await fetch(request.url, init).catch((err) => {
		// console.error(err);
		throw new RequestError(request, null, "fetch_failed", err.message);
	});
	let data = "";
	if (typeof options.dataReceivedCallback === "function") {
		// Stream response
		const reader = res.body?.getReader();
		await new Promise<void>((resolve, reject) => {
			(async function readNext() {
				try {
					const result = await reader?.read();
					options.dataReceivedCallback?.(result?.value);
					if (result?.done) {
						return resolve();
					}
					readNext();
				} catch (err) {
					reader?.cancel("error");
					reject(err);
				}
			})();
		});
	} else {
		data = await res.text();
	}

	const isJSON = data[0] === "{" || data[0] === "["; // || (res.headers['content-type'] || '').startsWith('application/json')
	if (res.status === 200) {
		const contextHeader = res.headers.get("DataBase-Context");
		let context: Record<string, any>;
		if (contextHeader && contextHeader[0] === "{") {
			context = JSON.parse(contextHeader);
		} else {
			context = {};
		}
		if (isJSON) {
			data = JSON.parse(data);
		}
		return { context, data };
	} else {
		request.body = postData;
		const response = {
			statusCode: res.status,
			statusMessage: res.statusText,
			headers: res.headers,
			body: data,
		};
		let code = res.status,
			message = res.statusText;
		if (isJSON) {
			const err = JSON.parse(data);
			if (err.code) {
				code = err.code;
			}
			if (err.message) {
				message = err.message;
			}
		}
		throw new RequestError(request, response, code, message);
	}
}
