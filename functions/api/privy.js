import { documentApi } from "../_lib/store.js";
export const onRequestGet = context => documentApi(context, "privy");
export const onRequestPost = context => documentApi(context, "privy");
export const onRequestPut = context => documentApi(context, "privy");
