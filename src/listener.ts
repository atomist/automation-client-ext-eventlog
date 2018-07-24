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

    public commandStarting(payload: CommandInvocation,
                           ctx: HandlerContext) {
        return this.sendEvent("command.start", (ctx as any).trigger, ctx);
    }

    public commandSuccessful(payload: CommandInvocation,
                             ctx: HandlerContext,
                             result: HandlerResult): Promise<void> {
        return this.sendOperation("command.success", "successful", ctx, result);
    }

    public commandFailed(payload: CommandInvocation,
                         ctx: HandlerContext,
                         err: any): Promise<void> {
        return this.sendOperation("command.failed", "failed", ctx, err);
    }

    public eventStarting(payload: EventFired<any>,
                         ctx: HandlerContext) {
        return this.sendEvent("event.start", (ctx as any).trigger, ctx);
    }

    public eventSuccessful(payload: EventFired<any>,
                           ctx: HandlerContext,
                           result: HandlerResult[]): Promise<void> {
        return this.sendOperation("event.success", "successful", ctx, result);
    }

    public eventFailed(payload: EventFired<any>,
                       ctx: HandlerContext,
                       err: any): Promise<void> {
        return this.sendOperation("event.failed", "failed", ctx, err);
    }

    public messageSent(message: any,
                       destinations: Destination | Destination[],
                       options: MessageOptions,
                       ctx: HandlerContext): Promise<void> {
        if (!message.timestamp && !message.category && !message.level && !message.message) {
            return this.sendEvent(
                "message",
                {
                    message,
                    destinations,
                    options,
                },
                ctx);
        }
        return Promise.resolve();
    }

    private sendOperation(identifier: string,
                          status: string,
                          ctx: HandlerContext,
                          err?: any) {
        if (!ctx) {
            return;
        }

        const data: any = {
            level: status === "failed" ? "error" : "info",
        };

        if (err) {
            if (status === "failed") {
                data.stacktrace = serializeError(err);
            } else if (status === "successful") {
                data.result = serializeError(err);
            }
        }

        return this.log(identifier, data, ctx, status === "failed" ? "error" : undefined);
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
        config.listeners.push(new EventLogAutomationEventListener());

        // Register the OnLog handler if we are getting some LogHandlers passed
        if (handlers && handlers.length > 0) {
            config.events = [...(config.events || []), onLogMaker(config.name, config.version, handlers)];
        }

        return config;
    };
}
