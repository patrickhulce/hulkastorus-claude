import {customAlphabet} from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const generateNanoId = customAlphabet(alphabet, 12);
