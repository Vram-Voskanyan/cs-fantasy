// Account field limits, shared by the forms and the server.
export const NAME_MIN = 3;
export const NAME_MAX = 24;
// Any non-empty password is accepted (decision 2026-10-29). The max only limits hashing cost.
export const PASSWORD_MIN = 1;
export const PASSWORD_MAX = 128;
