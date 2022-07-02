"use strict";
const http = require("http");
const express = require("express");
const RED = require("node-red");
const fs = require("fs");
const path = require("path");
const { app, ipcMain } = require("electron");
const { settings } = require('./Settings');
const isPortReachable = require('is-port-reachable');

function copyFileSync( source, target ) {
    var targetFile = target;

    if ( fs.existsSync( target ) ) {
        if ( fs.lstatSync( target ).isDirectory() ) {
            targetFile = path.join( target, path.basename( source ) );
        }
    }

    if (fs.existsSync(targetFile)) {
        return;
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync( source, target ) {
    var files = [];

    var targetFolder = path.join( target, path.basename( source ) );
    if ( !fs.existsSync( targetFolder ) ) {
        fs.mkdirSync( targetFolder, {recursive: true}, err => {} );
    }

    if ( fs.lstatSync( source ).isDirectory() ) {
        files = fs.readdirSync( source );
        files.forEach( function ( file ) {
            var curSource = path.join( source, file );
            if ( fs.lstatSync( curSource ).isDirectory() ) {
                copyFolderRecursiveSync( curSource, targetFolder );
            } else {
                copyFileSync( curSource, targetFolder );
            }
        } );
    }
}

function fixFlowNodeV2(filename) {
    console.log('fixFlowNodeV2 load:', filename);
    let flow = JSON.parse(fs.readFileSync(filename, { encoding: 'utf-8' }));
    if (flow.length < 1) return;
    let mofify = false;
    for (let i = 0; i < flow.length; i++) {
        if (flow[i].type === 'mqtt-broker' && flow[i].compatmode !== undefined) {
            delete flow[i].compatmode;
            flow[i] = Object.assign({
                "protocolVersion": "4",
                "autoConnect": true,
                "birthMsg": {},
                "closeTopic": "",
                "closePayload": "",
                "closeMsg": {},
                "willMsg": {},
                "sessionExpiry": "",
                "name": ""
            }, flow[i]);
            mofify = true;
        }
    }
    if (mofify) {
        console.log('fixFlowNodeV2 save:', filename);
        fs.writeFileSync(filename, JSON.stringify(flow), { encoding: 'utf-8' })
    }
}

function setup() {
    const listenPort = 1880;
    const flowFile = "flows.json";
    let status = "unknown";

    ipcMain.on("nodered/status/get", (event, data) => {
        event.sender.send("nodered/status", status);
    });

    return new Promise(async (resolve, reject) => {

        const reachable = await isPortReachable(listenPort);

        const isDebug = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
                        /[\\/]electron[\\/]/.test(process.execPath) ||
                        process.argv.indexOf("--debug-node-red") != -1;

        if (!reachable) {
            const userDir =  path.join(app.getPath("userData"), "node-red");
            const sourceDir = path.join(__dirname, "..", "assets", "node-red");

            copyFolderRecursiveSync(sourceDir, app.getPath("userData") );

            // Delete old flow
            ['climate-monitor.json', 'motion-detector.json', 'power-controller.json', 'co2-monitor.json'].forEach((filename) => {
                const filepath = path.join(userDir, "lib", "flows", filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            });

            try {
                fixFlowNodeV2(path.join(userDir, 'flows.json'));
            } catch (error) {
                console.log('fixFlowNodeV2', error);
            }

            var config = {
                uiPort: listenPort,
                verbose: true,
                httpAdminRoot: "/",
                httpNodeRoot: "/",
                userDir,
                flowFile,
                functionGlobalContext: {}, // enables global context
                logging: {
                    // Console logging
                    console: {
                        level: isDebug ? "debug" : "info",
                        metrics: false,
                        audit: false
                    },
                    // Custom logger
                    myCustomLogger: {
                        level: 'debug',
                        metrics: true,
                        handler: function(settings) {
                            return function(msg) {
                                if (msg.level == 50) {
                                    let m = msg.msg.match(/\[out\] > grpc@.*? install (.+)/);
                                    if (m) {
                                        console.log('Fix grpc binary');
                                        const source = path.join(app.getAppPath(), "node_modules", "grpc", "src", "node", "extension_binary");
                                        const target = path.join(m[1], 'src', 'node');
                                        console.log(source)
                                        console.log(target)
                                        copyFolderRecursiveSync(source, target);
                                    }
                                }
                            }
                        }
                    }
                }
            };

            let http_app = express();
            let server = http.createServer(http_app);
            RED.init(server, config);
            http_app.use(config.httpAdminRoot, RED.httpAdmin);
            http_app.use(config.httpNodeRoot, RED.httpNode);

            RED.start().then(function () {
                server.listen(listenPort, settings.get("node-red-bind"), ()=>{
                    status = "online";

                    resolve();
                });
            }).catch(function(err) {
                RED.log.error(RED.log._("server.failed-to-start"));
                if (err.stack) {
                    RED.log.error(err.stack);
                } else {
                    RED.log.error(err);
                }
            });

        } else {
            status = "external";

            reject();
        }
    });
}

module.exports = {
    setup
}
