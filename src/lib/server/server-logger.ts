import { ActorType, Logger, LogFields } from "@/lib/logger";

type BaseServerLogFields = LogFields & {
    route: string;
    actorType: ActorType;
};

export function createServerLogger(context: string, baseFields: BaseServerLogFields) {
    const mergeFields = (fields?: LogFields): LogFields => ({
        ...baseFields,
        ...fields
    });

    return {
        info(message: string, fields?: LogFields) {
            Logger.info(message, mergeFields(fields), context);
        },
        warn(message: string, fields?: LogFields) {
            Logger.warn(message, mergeFields(fields), context);
        },
        error(message: string, fields?: LogFields) {
            Logger.error(message, mergeFields(fields), context);
        },
        debug(message: string, fields?: LogFields) {
            Logger.debug(message, mergeFields(fields), context);
        }
    };
}
