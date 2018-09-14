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

import { guid } from "@atomist/automation-client";
import * as assert from "power-assert";
import {
    AtomistLog,
    LogHandler,
    OnLog,
} from "../lib/eventLog";

describe("eventLog", () => {

    it("logHandler should get invoked", async () => {

        let logEvent: AtomistLog;
        const handler: LogHandler = log => {
            logEvent = log;
            return Promise.resolve();
        };

        const onLog: OnLog = new OnLog("name", "version", [handler]);
        const result = await onLog.handle({
            data: {
                AtomistLog: [{
                   level: "info",
                   message: "this is a test message",
                   correlation_context: {
                       correlation_id: guid(),
                   },
                   timestamp: Date.now(),
                }],
            },
            extensions: {
                operationName: "OnLog",
            },
        }, null);

        assert.equal(logEvent.level, "info");
        assert.equal(logEvent.message, "this is a test message");

        return result;
    });

});
