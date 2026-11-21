// A worker of the ring (ring.js): it fetches a picture of the ring and decodes it off the page's main thread. It knows
// nothing of the ring: each message names a picture.
//
// {wanted: [address, ...]} names every picture the ring still wants: the worker drops the others it holds, stopping
// their downloads. {address} queues a picture. The worker downloads the first FETCHES pictures of its queue at once, so
// the next picture's download overlaps this one's decode, and decodes one at a time, in the order asked. Each picture
// is answered once: {address, cells}, where cells holds the picture's one bitmap, transferred, {address, dropped}, or
// {address, failed}. Keep each field's name and shape, since a page can pair this worker with a ring.js of another
// publish.
const FETCHES = 3;
const queue = [];
let decoding = false;

onmessage = ({ data }) => {
  if (data.wanted) {
    const wanted = new Set(data.wanted);
    for (let i = queue.length - 1; i >= 0; i--) {
      if (wanted.has(queue[i].address)) continue;
      queue[i].stop.abort();
      postMessage({ address: queue[i].address, dropped: true });
      queue.splice(i, 1);
    }
  } else {
    queue.push({ address: data.address, stop: new AbortController() });
  }
  next();
};

function download(job) {
  if (job.body) return;
  job.body = fetch(job.address, { signal: job.stop.signal }).then(response => {
    if (!response.ok) throw new Error(response.statusText);
    return response.blob();
  });
  // A download the ring stops before the decode asks for it rejects unseen.
  job.body.catch(() => {});
}

async function next() {
  queue.slice(0, FETCHES).forEach(download);
  if (decoding || !queue.length) return;
  decoding = true;
  const job = queue[0], { address } = job;
  try {
    const bitmap = await createImageBitmap(await job.body);
    if (queue.includes(job)) postMessage({ address, cells: [bitmap] }, [bitmap]);
    else bitmap.close();
  } catch (error) {
    if (queue.includes(job)) postMessage(error.name === 'AbortError' ? { address, dropped: true } : { address, failed: String(error) });
  }
  const at = queue.indexOf(job);
  if (at >= 0) queue.splice(at, 1);
  decoding = false;
  next();
}
