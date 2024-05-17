export function encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
export function decode(base64) {
    return decodeURIComponent(escape(atob(base64)));
}
export default {
    encode,
    decode,
};
//# sourceMappingURL=browser.js.map