import React, { Component } from "react";
import { Input, FormGroup, Label, Alert, Button } from 'reactstrap';
const { ipcRenderer } = require("electron");
import Moment from 'moment';
export default class extends Component {

    constructor(props) {
        super(props);
        this.state = {
            isConnected: props.model.isConnect(),
            status: props.model.getStatus(),
            values: props.model.getValues(),
            showUdevHint: props.model.getShowUdevHint(),
            delay: ipcRenderer.sendSync('settings/get-sync', 'enmon-delay'),
        };
        this.onConnect = this.onConnect.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onStatus = this.onStatus.bind(this);
        this.buttonOnClick = this.buttonOnClick.bind(this);
        this.handleChangeDelay = this.handleChangeDelay.bind(this);
    }

    componentDidMount() {
        console.log("Bridge:componentDidMount");
        this.props.model.on('connect', this.onConnect);
        this.props.model.on('message', this.onMessage);
        this.props.model.on('status', this.onStatus);

        ipcRenderer.send("bridge/status/get");
    }
    componentWillUnmount() {
        console.log("Bridge:componentWillUnmount");
        this.props.model.removeListener('connect', this.onConnect);
        this.props.model.removeListener('message', this.onMessage);
        this.props.model.removeListener('status', this.onStatus);
    }

    onConnect(connect) {
        this.setState({ isConnected: connect });
    }

    onStatus(payload) {
        if (this.state.status !== payload.status || this.state.showUdevHint !== payload.showUdevHint) {
            this.setState({ status: payload.status, showUdevHint: payload.showUdevHint });
            this.setState( { values: this.props.model.getValues() });
        }
    }

    onMessage(message) {
        console.log("Render on message", message);
        this.setState( { values: this.props.model.getValues() });
    }

    buttonOnClick() {
        if (this.state.status !== "disabled") {
            this.setState({ enable: false });
            ipcRenderer.send("settings/set", { key: 'enmon-enable', value: false });
        } else {
            this.setState({ enable: true });
            ipcRenderer.send("settings/set", { key: 'enmon-enable', value: true });
        }
    }

    handleChangeDelay(event) {
        this.setState({delay: event.target.value});
        ipcRenderer.send("settings/set", { key: 'enmon-delay', value: event.target.value });
    }

    render() {
        return (
            <div id="bridge" >
                <div className="form-inline">
                    <FormGroup className="mb-2 mr-sm-2 mb-sm-0">
                        <Label className="mr-sm-2"></Label>
                        <Button disabled={false} color={this.state.status != 'disabled' ? "danger": "success"} onClick={this.buttonOnClick}>{this.state.status != 'disabled' ? "Disable Bridge" : "Enable Bridge"}</Button>
                    </FormGroup>
                    <FormGroup className="mb-2 mr-sm-2 mb-sm-0">
                        <Label className="mr-sm-2">Update interval</Label>
                        <Input value={this.state.delay} onChange={this.handleChangeDelay} type="number" min="1" max="3600" step="1"></Input>
                    </FormGroup>

                </div>
                    {this.state.showUdevHint ? <div><br/><Alert color="warning">
                    For work on linux without sudo you must create udev rule<br/>
                    You can use this command:<br/>
                    echo 'SUBSYSTEMS=="usb", ACTION=="add", ATTRS{'{idVendor}'}=="0403", ATTRS{'{idProduct}'}=="6030", MODE="0666"' | sudo tee /etc/udev/rules.d/99-enmon.rules
                    <br/><br/>
                    Please disconnect and connect Bridge Module again after you type command above
                    </Alert></div> : null}

                    <table className="table table-bordered table-hover values">
                        <thead>
                            <tr>
                                <th>Label</th>
                                <th>Value</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                this.state.values.map((item, index) => {
                                    return (
                                        <tr key={index}>
                                            <td >
                                                {item.label}
                                            </td>
                                            <td>
                                                {item.value}
                                            </td>
                                            <td>
                                                {Moment(item.time).format('HH:mm:ss')}
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                    </table>

            </div>
        )
    }
}
