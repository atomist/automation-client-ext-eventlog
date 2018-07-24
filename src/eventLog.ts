/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    EventFired,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    Success,
} from "@atomist/automation-client";
import { subscription } from "@atomist/automation-client/graph/graphQL";
import { EventHandlerMetadata } from "@atomist/automation-client/metadata/automationMetadata";
import { addressEvent } from "@atomist/automation-client/spi/message/MessageClient";

// Subscription to retrieve all Log events for this automation client
const LogSubscription = `subscription OnLog($name: String!, $version: String!) {
  AtomistLog {
    level
    timestamp
    message
    correlation_context @required {
      correlation_id
      automation(name: $name, version: $version) @required {
        name
        version
      }
    }
  }
}`;

export interface Subscription {
    AtomistLog?: AtomistLog[] | null;
}

export interface AtomistLog {
    level?: string | null;
    category?: string | null;
    timestamp?: number | null;
    message?: string | null;
    correlation_context?: CorrelationContext | null;
}

export interface CorrelationContext {
    correlation_id?: string | null;
    automation?: Automation | null;
}

export interface Automation {
    name?: string | null;
    version?: string | null;
}

export const OnLogName: string = "OnLog";

/**
 * Subscribe to AtomistLog events from the API.
 */
export class OnLog implements HandleEvent<Subscription>, EventHandlerMetadata {

    public name: string = OnLogName;
    public description: string = "Subscribe to AtomistLog events from the API";
    public subscriptionName: string = OnLogName;
    public subscription: string;

    constructor(private eman: string,
                private version: string,
                private logHandlers: LogHandler[] = [ConsoleLogHandler]) {
        this.subscription = subscription({
            subscription: LogSubscription,
            variables: {
                name: eman,
                version,
            },
            inline: true,
        });
    }

    public async handle(e: EventFired<Subscription>, ctx: HandlerContext): Promise<HandlerResult> {
        const log = e.data.AtomistLog[0];

        for (const logHandler of this.logHandlers) {
            await logHandler(log, ctx);
        }

        return Success;
    }
}

/**
 * Maker that gets registered to subscribe to log events
 * @param {string} name
 * @param {string} version
 * @param {LogHandler[]} logHandlers
 * @returns {() => OnLog}
 */
export function onLogMaker(name: string,
                           version: string,
                           logHandlers: LogHandler[]) {
    return () => new OnLog(name, version, logHandlers);
}

/**
 * Handler that can get added to the automation client configuration to handle log messages
 */
export type LogHandler = (log: AtomistLog, ctx: HandlerContext) => Promise<void>;

/**
 * Default console logging LogHandler
 * @param {AtomistLog} log
 * @param {HandlerContext} ctx
 * @returns {Promise<void>}
 * @constructor
 */
export const ConsoleLogHandler: LogHandler = async log => {
    const date = new Date(log.timestamp);
    logger.log(log.level, `Incoming log message '${date} [${log.correlation_context.correlation_id}] ${log.message}'`);
};

/**
 * Send AtomistLog message.
 * @param {AtomistLog} log
 * @param {HandlerContext} ctx
 * @returns {Promise<any>}
 */
export function sendLog(log: AtomistLog, ctx: HandlerContext): Promise<any> {
    return ctx.messageClient.send(log, addressEvent("AtomistLog"));
}
