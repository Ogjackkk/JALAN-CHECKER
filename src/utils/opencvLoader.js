// Lightweight runtime loader that injects OpenCV's CDN script and resolves when ready
const loadOpenCV = (opts = {}) => {
  const version = opts.version || "4.7.0";
  const cdnUrl = opts.url || `https://docs.opencv.org/${version}/opencv.js`;
  const localUrl = opts.local || "/opencv.js"; // public/opencv.js

  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) return resolve(window.cv);
    if (document.getElementById("opencv-js-script")) {
      const check = () => {
        if (window.cv && window.cv.Mat) return resolve(window.cv);
        setTimeout(check, 100);
      };
      return check();
    }

    const insert = (url) => {
      const script = document.createElement("script");
      script.id = "opencv-js-script";
      script.async = true;
      script.type = "text/javascript";
      script.src = url;
      script.onerror = () => reject(new Error("Failed to load OpenCV from " + url));
      script.onload = () => {
        const poll = () => {
          if (window.cv && window.cv.Mat) return resolve(window.cv);
          setTimeout(poll, 100);
        };
        poll();
      };
      document.head.appendChild(script);
    };

    // try CDN first, fallback to local
    insert(cdnUrl);
    // if CDN returns 406 or fails, fallback by waiting a short time then load local
    setTimeout(() => {
      if (!(window.cv && window.cv.Mat)) {
        // remove CDN script tag if present and try local
        const s = document.getElementById("opencv-js-script");
        if (s) s.remove();
        insert(localUrl);
      }
    }, 3000);
  });
};

export default loadOpenCV;