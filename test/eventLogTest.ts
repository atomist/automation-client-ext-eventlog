import { guid } from "@atomist/automation-client/internal/util/string";
import "mocha";
import * as assert from "power-assert";
import {
    AtomistLog,
    LogHandler,
    OnLog,
} from "../src/eventLog";

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
