/**
 * @copyright 2010, Ajax.org Services B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
require("../../support/paths");

var Connect = require("connect");
var IO = require("socket.io");
var Fs = require("fs");
var Path = require("path");
var IdeServer = require("./ide");
var User = require("./user");
var middleware = require("./middleware");
var oAuthGitHub = require("./oAuthGitHub");

exports.main = function(options) {
    var projectDir = options.workspace,
        port = options.port,
        ip = options.ip,
        user = options.user || "owner",
        group = options.group;
        
    if (!Path.existsSync(projectDir)) 
        throw new Error("Workspace directory does not exist: " + projectDir);
        
    var ideProvider = function(projectDir, server) {
        // load plugins:
        var exts = {};
        Fs.readdirSync(Path.normalize(__dirname + "/ext")).forEach(function(name){
            exts[name] = require("./ext/" + name);
        });
        
        // create web socket
        var socketOptions = {
            transports:  ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
        };
        var socketIo = IO.listen(server, socketOptions);
        socketIo.on("connection", function(client) {
            if(typeof user == 'object'){
                var length = user.length;
                while(length--){
                    ide.addClientConnection(user[length].name, client, null);    
                }
            }
            else {
                ide.addClientConnection(user, client, null);
            }
        });
        
        var name = projectDir.split("/").pop();
        var serverOptions = {
            workspaceDir: projectDir,
            davPrefix: "/workspace",
            baseUrl: "",
            debug: options.debug,
            staticUrl: "/static",
            workspaceId: name,
            name: name,
            version: options.version
        };
        var ide = new IdeServer(serverOptions, server, exts);
        
        if(typeof user == 'object'){
            var length = user.length;
            while(length--){
                
                var permissions = User.OWNER_PERMISSIONS;
                
                if(user[length].permission === "collaborator"){   
                    permissions = User.COLLABORATOR_PERMISSIONS;
                }
                
                ide.addUser(user[length].name, permissions);
            }
        }
        else {
            ide.addUser(user, User.OWNER_PERMISSIONS);
        }
        
        return function(req, res, next) {
            if(req.session.uid && !ide.hasUser(req.session.uid)){
                return next();   
            }
            oAuthGitHub(req, res, next, ide);
        };
    };
    
    var server =  Connect.createServer();
    //server.use(Connect.logger());
    server.use(Connect.conditionalGet());
    server.use(Connect.cookieDecoder());
    server.use(Connect.session({
        key: "cloud9.sid"
    }));
    server.use(ideProvider(projectDir, server));
    server.use(middleware.staticProvider(Path.normalize(__dirname + "/../../support"), "/static/support"));
    server.use(middleware.staticProvider(Path.normalize(__dirname + "/../../client"), "/static"));

    //obfuscate process rights if configured
    if (group)
        process.setgid(group);
    if (user)
        //process.setuid(user);

    server.listen(port, ip);
};

process.on("uncaughtException", function(e) {
    console.log("uncaught exception:");
    console.log(e.stack + "");
});

if (module === require.main) {
    exports.main({workspace: ".", port: 3000, ip: '127.0.0.1'});
}
