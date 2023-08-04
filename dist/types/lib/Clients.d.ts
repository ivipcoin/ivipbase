/// <reference types="node" />
import { EventSubscriptionCallback, Query, QueryOptions } from "acebase-core";
import { DbUserAccountDetails } from "../Schema/user";
import { HttpSocket } from "../types";
export type Transactions = {
    id: string;
    started: number;
    path: string;
    context: any;
    finish?: (val?: any) => Promise<{
        cursor?: string;
    }>;
    timeout: NodeJS.Timeout;
};
export declare class ConnectedClient {
    socket: HttpSocket;
    readonly id: string;
    /**
     *
     * @param socket Socket object used by the framework
     * @param id optional: use if the socket object does not have an `id` property.
     */
    constructor(socket: HttpSocket, id?: string);
    readonly connectedDate: Date;
    /** user details if this socket client is signed in */
    user?: DbUserAccountDetails;
    /** Active event subscriptions for this client */
    subscriptions: {
        [path: string]: Array<{
            path: string;
            event: string;
            callback: EventSubscriptionCallback;
        }>;
    };
    /** Active realtime query subscriptions for this client */
    realtimeQueries: {
        [id: string]: {
            path: string;
            query: Query;
            options: QueryOptions;
        };
    };
    /** Currently running transactions */
    transactions: {
        [id: string]: Transactions;
    };
}
//# sourceMappingURL=Clients.d.ts.map