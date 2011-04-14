var http = require("http");
var Url = require("url");
var querystring = require("querystring");

var GitHubApi = require("github").GitHubApi;
var OAuth2 = require("oauth2").OAuth2;

var github = new GitHubApi(true);
var gitHubUser = github.getUserApi();
var repo = github.getRepoApi();

var clientId = "xxxxxxxxxxxxxxxxxxxx";
var secret = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
var oauth = new OAuth2(clientId, secret, 'https://github.com/', 'login/oauth/authorize', 'login/oauth/access_token');
var User = require("./user");

// for demo purposes use one global access token
// in production this has to be stored in a user session

var oAuthGitHub = function (req, res, next, ide) {
    var url = Url.parse(req.url);
    var path = url.pathname;
    var query = querystring.parse(url.query);
    
    if (path == "/" && !query.code && !req.session.uid) {
        res.writeHead(303, {
            Location: oauth.getAuthorizeUrl({ 
              redirect_uri: 'http://c9/',
              scope: "user,repo,gist"
            })
        });
        res.end();
        return;
    } 
    // URL called by github after authenticating
    else if (path == "/" && query.code && !req.session.uid) {
        // upgrade the code to an access token
        oauth.getOAuthAccessToken(query.code, {}, function (err, access_token, refresh_token) {
            if (err) {
                return next(err);
            }
            github.authenticateOAuth(access_token);
            req.session.accessToken = access_token;
            
            // use github API            
                gitHubUser.show(function(err, user) {
                if (err) {
                    console.log(err);
                    return next();
                }
                req.session.uid = user.login;
                
                var c9user = ide.getUser(req);
                if(c9user !== null){
                    ide.handle(req, res, next);
                    return;
                }
                else{
                    return next();
                }
            });
        });
    }
    else if(req.session.uid) {
        ide.handle(req, res, next);
    }
    else {
        return next();
    }
};

module.exports = oAuthGitHub;

