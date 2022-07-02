const EventEmitter = require('events');
// const mqtt = require("mqtt");
const { ipcRenderer } = require("electron");

export default class extends EventEmitter {

    constructor() {
        super();
        this._url = null;
        this._connect = false;
        this._values_map = {};
        this._values_list = [];

        ipcRenderer.on("bridge/msg", this.ipcBridgeMsq.bind(this));
        ipcRenderer.on("bridge/status", this.ipcBridgeStatus.bind(this));

        this._newMessage = this._newMessage.bind(this);

        this._status = "disabled";
        this._showUdevHint = false;
    }

    ipcBridgeMsq(sender, message) {
        // console.log('ipcBridgeMsq', message);
        this._newMessage(message);
    }

    _newMessage(message) {
        // console.log('_newMessage', message);

        const tmp = this._values_map[message.label];
        if (tmp) {
            tmp.value = message.value;
            tmp.time = message.time || new Date();
        } else {
            this._values_map[message.label] = {
                label: message.label,
                value: message.value,
                time: message.time || new Date()
            };
            this._values_list = Object.values(this._values_map).sort((a,b)=>{return a.label < b.label ? -1 : 1});
        }

        this.emit("message", message);
    }

    ipcBridgeStatus(sender, payload) {
        if (this._status !== payload.status || this._showUdevHint !== payload.showUdevHint) {
            this._status = payload.status;
            this._showUdevHint = payload.showUdevHint;

            if (payload.status !== 'online') {
                this.resetValuesList();
            }

            this.emit("status", payload);
        }
    }

    getValues() {
        return this._values_list;
    }

    resetValuesList() {
        this._values_map = {};
        this._values_list = [];
    }

    getStatus() {
        return this._status;
    }

    getShowUdevHint() {
        return this._showUdevHint;
    }

    isConnect() {
        return true; // this._connect;
    }

    /* Disable mqtt used ipc
    connect(url) {
        if (this._url == url) return;

        if (this.mqttConnect) {
            this.client.end(true);
            this.mqttConnect = false;
        }

        this._url = url;

        this.client = mqtt.connect(this._url);

        this.client.on("connect", () => {
            this._connect = true;
            this.emit("connect", true);
            this.client.subscribe('bridge/#');
        });

        this.client.on("disconnect", () => {
            this._connect = false;
            this.emit("connect", false);
        });

        this.client.on("message", (topic, data) => {
            let message = { topic: topic.substring(7), payload: data.toString() };

            const tmp = this._values_map[message.topic];
            if (tmp) {
                tmp.value = message.payload;
                tmp.time = new Date();
            } else {
                this._values_map[message.topic] = {
                    label: message.topic[0].toUpperCase() + message.topic.substring(1),
                    value: message.payload,
                    time: new Date()
                };
                this._values_list = Object.values(this._values_map).sort((a,b)=>{return a.label < b.label ? -1 : 1});
            }

            this.emit("message", message);
        });
    }
    */
}
