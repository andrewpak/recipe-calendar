const http = require("http");
const https = require("https");
const url = require("url");
const fs = require("fs")
// const auth = require("./auth/auth.json");
const crypto = require("crypto");
const port = 3000;
const queryString = require("querystring");
const {client_id, scope, response_type, redirect_uri, apiKey, limitLicense, ignorePantry} = require("./auth/auth.json");
const server = http.createServer();
let task_states = [];
let task;
let mealOne;
server.on("request", connection_handler);

function connection_handler(req, res){
    console.log(`New Request Received from ${req.url}`);
    if(req.url === '/'){

      let formStream =  fs.createReadStream("./html/home.html"); // was form.html
      res.writeHead(200, {"Content-Type": "text/html"});
      formStream.pipe(res);
     
    } 
    else if(req.url.startsWith("/get_meal")){
      let meal_input = url.parse(req.url, true).query;
      spoonacular_query(meal_input, res);
    }
    else if(req.url.startsWith("/redirectPart1")) { 
  
    let formStream =  fs.createReadStream("./html/redirect.html");
    formStream.pipe(res);

    }
    else if(req.url.startsWith("/redirectPart2")){
      console.log(req.url);
      const user_token =  url.parse(req.url, true).query;
      const token_request_time = new Date();
      create_token_cache(user_token, token_request_time);
      send_calendar_task(mealOne, user_token, res);
    } 

    else {

    }
  
 
}

function redirect_to_calendar(state, res){
  const auth_endpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  let uri = queryString.stringify({client_id, scope, response_type, redirect_uri, state});
  res.writeHead(302, {Location: `${auth_endpoint}?${uri}`}).end();
}

function spoonacular_query(ingredient, res){
console.log(ingredient);
let ing = ingredient.ingredients;
console.log(ing);
const spoonacular_endpoint = "https://api.spoonacular.com/recipes/findByIngredients";
let uri = queryString.stringify({apiKey, limitLicense, ignorePantry});
console.log(apiKey);
let newEndpoint =`${spoonacular_endpoint}?${uri}&ingredients=${ing}`;
https.request(newEndpoint, (task_stream) => process_stream(task_stream, reveive_spoonacular_response, res)).end();
}

function send_calendar_task(task, user_token, res){
const task_endpoint = "https://www.googleapis.com/calendar/v3/calendars/222ccm0g98bm50knud8rll62co@group.calendar.google.com/events/quickAdd";
const post_data = JSON.stringify({"text":task});
token_request_time = new Date(); // for cache
console.log(post_data);
console.log(post_data);

let myToken =  user_token.access_token;
let myScope = user_token.scope;
      const options = {
            method: "POST",
            headers: {
              Authorization: `Bearer ${myToken}`,
              scope: myScope
                }
            }
https.request(task_endpoint, options, (task_stream) => process_stream(task_stream, receive_task_response, res)).end(post_data);
let formStream =  fs.createReadStream("./html/success.html");
formStream.pipe(res);
}


function process_stream (stream, callback , ...args){
	let body = "";
	stream.on("data", chunk => body += chunk);
	stream.on("end", () => callback(body, ...args));
}

function receive_task_response(body, res){
const results = JSON.parse(body);
console.log(results);
res.writeHead(302, {Location:`${results.url}`}).end();
}

function reveive_spoonacular_response(body, res){
const results = JSON.parse(body);
let randomInt = getRandomInt(10);
if(Object.keys(results).length === 0){ //if the users input didn't yield any results from the API
    not_found(res);
} else {
mealOne = results[randomInt].title; // selects a random meal title relative to the user input from the json that the api sent back
console.log(mealOne);
//console.log(results);

task = mealOne;
const state = crypto.randomBytes(20).toString("hex"); // creating session
task_states.push({task, state});

const token_cache = './auth/cache.json';
let cache_valid = false;
    if(fs.existsSync(token_cache)){
    cache_token = require(token_cache);
    if(new Date(cache_token.expiration) > Date.now()){
        cache_valid = true;
        }
    }
    if(cache_valid){
    let access_token = cache_token;
    console.log("Cache Exists and is Valid")
    //synchronously sends google calendar the meal name and adds it as an event
    //if the token has already been cached
    send_calendar_task(mealOne, access_token, res);
    } else {
    //synchronously calls the other API , google calendar.    
    redirect_to_calendar(state,res);
    }
 }
}
// needed this function to generate random int
function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
function create_token_cache (token, token_request_time){
    token.expiration = new Date(token_request_time.getTime() + (token.expires_in * 1000)) ;
    console.log("Token Object", token);
    fs.writeFile('./auth/cache.json', JSON.stringify(token), () =>{});
    console.log("Cache Created.")
}
function not_found(res){
    res.writeHead(404, {"Content-Type":"text/plain"});
    res.write("404 Not Found",()=>res.end());
}
server.on("listening", () => console.log(`Now Listening on Port ${port}`));
server.listen(port);


 