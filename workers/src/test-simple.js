export default {
  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Test Worker Running',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};