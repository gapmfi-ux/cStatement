// Updated JSONP callback function to ensure proper timing for callback execution.
function jsonpCallback(data) {
    // Process the JSONP response data here
    console.log(data);
}

// Example of how to trigger the callback
setTimeout(() => {
    jsonpCallback({ key: 'value' });
}, 100); // Ensure this is called after the response is ready
