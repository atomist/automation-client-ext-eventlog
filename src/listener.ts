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
    AutomationContextAware,
    Configuration,
    EventFired,
    HandlerContext,
    HandlerResult,
} from "@atomist/automation-client";
import { CommandInvocation } from "@atomist/automation-client/internal/invoker/Payload";
import { replacer } from "@atomist/automation-client/internal/transport/AbstractRequestProcessor";
import {
    AutomationEventListener,
    AutomationEventListenerSupport,
} from "@atomist/automation-client/server/AutomationEventListener";
import {
    Destination,
    MessageOptions,
    SlackDestination,
} from "@atomist/automation-client/spi/message/MessageClient";
import * as stringify from "json-stringify-safe";
import * as serializeError from "serialize-error";
import {
    AtomistLog,
    LogHandler,
    onLogMaker,
    sendLog,
} from "./eventLog";

export class EventLogAutomationEventListener extends AutomationEventListenerSupport
    implements AutomationEventListener {

    private logHandlerName: string;

    constructor(configuration: Configuration) {
        super();
        this.logHandlerName = onLogMaker(configuration.name, configuration.version)().name;
    }

    public commandStarting(payload: CommandInvocation,
                           ctx: HandlerContext) {
        return this.sendOperation(
            "command.start",
            payload.name,
            "command",
            "start",
            ctx,
            (ctx as any).trigger);
    }

    public commandSuccessful(payload: CommandInvocation,
                             ctx: HandlerContext,
                             result: HandlerResult): Promise<void> {
        return this.sendOperation(
            "command.success",
            payload.name,
            "command",
            "success",
            ctx,
            result);
    }

    public commandFailed(payload: CommandInvocation,
                         ctx: HandlerContext,
                         err: any): Promise<void> {
        return this.sendOperation(
            "command.failure",
            payload.name,
            "command",
            "failure",
            ctx,
            err);
    }

    public eventStarting(payload: EventFired<any>,
                         ctx: HandlerContext) {
        return this.sendOperation(
            "event.start",
            payload.extensions.operationName,
            "event",
            "start",
            ctx,
            (ctx as any).trigger);
    }

    public eventSuccessful(payload: EventFired<any>,
                           ctx: HandlerContext,
                           result: HandlerResult[]): Promise<void> {
        return this.sendOperation(
            "event.success",
            payload.extensions.operationName,
            "event",
            "success",
            ctx,
            result);
    }

    public eventFailed(payload: EventFired<any>,
                       ctx: HandlerContext,
                       err: any): Promise<void> {
        return this.sendOperation(
            "event.failure",
            payload.extensions.operationName,
            "event",
            "failure",
            ctx,
            err);
    }

    public messageSent(message: any,
                       destinations: Destination | Destination[],
                       options: MessageOptions,
                       ctx: HandlerContext): Promise<void> {

        const destinationsArray = Array.isArray(destinations) ? destinations : [ destinations ];

        // Only send slack messages as custom events etc are already being logged in the backend
        if (destinationsArray.some(d => d.userAgent === SlackDestination.SLACK_USER_AGENT)) {
            return this.sendEvent(
                "message",
                {
                    payload: message,
                    destinations,
                    options,
                },
                ctx);
        }
        return Promise.resolve();
    }

    private sendOperation(identifier: string,
                          name: string,
                          type: string,
                          status: string,
                          ctx: HandlerContext,
                          err?: any) {
        if (!ctx) {
            return Promise.resolve();
        }

        // Don't log anything for the AtomistLog handler
        if (name === this.logHandlerName) {
            return Promise.resolve();
        }

        const data: any = {
            name,
            type,
            status,
        };

        if (err) {
            if (status === "failure") {
                data.error = serializeError(err);
            } else if (status === "success") {
                data.result = err;
            } else {
                data.payload = err;
            }
        }

        return this.log(identifier, data, ctx, status === "failure" ? "error" : undefined);
    }

    private sendEvent(identifier: string,
                      payload: any,
                      ctx: HandlerContext) {
        if (!ctx) {
            return;
        }

        return this.log(identifier, payload, ctx);
    }

    private log(category: string, data: any, ctx: HandlerContext, level: string = "info") {
        const log: AtomistLog = {
            team_id: ctx.workspaceId,
            timestamp: Date.now(),
            level,
            message: stringify(data, replacer),
            category: `atomist.automation.${category}`,
            correlation_context: {
                correlation_id: ctx.correlationId,
                automation: {
                    name: (ctx as any as AutomationContextAware).context.name,
                    version: (ctx as any as AutomationContextAware).context.version,
                },
            },
        };

        return sendLog(log, ctx);
    }
}

/**
 * Configure the automation client to send AtomistLog entries for relevant handler events.
 * @param {Configuration} config
 * @returns {Promise<Configuration>}
 */
export function configureEventLog(...handlers: LogHandler[]): (config: Configuration) => Promise<Configuration> {
    return async config => {
        config.listeners.push(new EventLogAutomationEventListener(config));

        // Register the OnLog handler if we are getting some LogHandlers passed
        if (handlers && handlers.length > 0) {
            config.events = [ ...(config.events || []), onLogMaker(config.name, config.version, ...handlers) ];
        }

        return config;
    };
}
