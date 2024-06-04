import { LocalServer, RouteRequest } from "..";
import { sendNotAuthenticatedError } from "../shared/error";
import { signIn } from "../shared/signin";
import { decodePublicAccessToken, findValidPasswordByToken, PublicAccessToken } from "../shared/tokens";

export const addMiddleware = (env: LocalServer) => {
	// Add bearer authentication middleware
	env.router.use(async (req: RouteRequest<{ auth_token?: string }>, res, next) => {
		let authorization = req.get("Authorization");
		if (typeof authorization !== "string" && "auth_token" in req.query) {
			// Enables browser calls to be authenticated by adding the access token as auth_token query parameter
			if (req.path.startsWith("/export/") || req.path.startsWith("/logs")) {
				// For now, only allow '/export' or '/logs' api calls
				// In the future, use these prerequisites:
				// - user must be currently authenticated (in cache)
				// - ip address must match the token
				authorization = "Bearer " + req.query.auth_token;
			}
		}

		if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
			const token = authorization.slice(7);

			const tokenSalt = findValidPasswordByToken(token, Object.values(env.tokenSalt));

			if (!tokenSalt) {
				// Token salt not ready yet, skip authentication
				return next();
			}

			let tokenDetails: PublicAccessToken;
			try {
				tokenDetails = decodePublicAccessToken(token, tokenSalt);
			} catch (err) {
				return sendNotAuthenticatedError(res, "invalid_token", "The passed token is invalid. Sign in again");
			}

			// Is this token cached?
			let user = env.authCache.get(tokenDetails.uid);
			if (!user) {
				// Query database to get user for this token
				try {
					user = await signIn(tokenDetails.database, { database: tokenDetails.database, method: "internal", access_token: tokenDetails.access_token }, env, req);
				} catch (err) {
					return sendNotAuthenticatedError(res, (err as any).code, (err as any).message);
				}
			}

			req.database_name = tokenDetails.database;
			req.user = user;

			if (req.user.is_disabled === true) {
				return sendNotAuthenticatedError(res, "account_disabled", "Your account has been disabled. Contact your database administrator");
			}
		}
		next();
	});
};

export default addMiddleware;
