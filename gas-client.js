// Define the callback function first
function jsonpCallback(response) {
    // Handle the JSONP response here
}

// Then append the script tag to the DOM
var script = document.createElement('script');
script.src = 'https://example.com/api?callback=jsonpCallback';
document.body.appendChild(script);