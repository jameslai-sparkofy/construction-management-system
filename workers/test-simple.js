export default {
  async fetch(request) {
    return new Response(JSON.stringify({
      message: "Hello from new worker!",
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};