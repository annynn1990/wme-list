import { documentApi } from "../_lib/store.js";
export const onRequestGet = context => documentApi(context, "cabinet");
export const onRequestPost = context => documentApi(context, "cabinet");
export const onRequestPut = context => documentApi(context, "cabinet");
