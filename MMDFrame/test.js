let LoadEventHolder = class {
    callbackFunc = Function();
    returnCallbackArgs = Array();
    __onLoadEventTriggered = Boolean();
    __allowMultiTrigger = Boolean();

    constructor() { }

    event(callback) {
        this.callbackFunc = callback
    }
}

let LogHolder = class {

    constructor() { }

}