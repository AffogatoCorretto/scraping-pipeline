document.addEventListener('DOMContentLoaded', () => {
  const svg = document.querySelector('.connections');

  const pairs = [
    { from: '#google-box', to: '#extract-box', path: '#google-to-extract' },
    { from: '#reddit-box', to: '#extract-box', path: '#reddit-to-extract' },
    { from: '#instagram-box', to: '#extract-box', path: '#instagram-to-extract' },
    { from: '#tiktok-box', to: '#extract-box', path: '#tiktok-to-extract' },
    { from: '#extract-box', to: '#direct-gems-box', path: '#extract-to-direct-gems' },
    { from: '#direct-gems-box', to: '#content-analysis-box', path: '#direct-gems-to-content' },
    { from: '#content-analysis-box', to: '#indexing-pipeline-box', path: '#content-to-indexing' },
    { from: '#another-extra-box', to: '#content-analysis-box', path: '#another-to-content' }
  ];

  function getCenter(el) {
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    return {
      x: rect.left + scrollLeft + rect.width / 2,
      y: rect.top + scrollTop + rect.height / 2
    };
  }

  function positionPaths() {
    const svgRect = svg.getBoundingClientRect();
    pairs.forEach(pair => {
      const fromEl = document.querySelector(pair.from);
      const toEl = document.querySelector(pair.to);
      const pathEl = document.querySelector(pair.path);

      if (!fromEl || !toEl || !pathEl) return;

      const fromCenter = getCenter(fromEl);
      const toCenter = getCenter(toEl);

      const svgTop = svgRect.top + window.pageYOffset;
      const svgLeft = svgRect.left + window.pageXOffset;

      const x1 = fromCenter.x - svgLeft;
      const y1 = fromCenter.y - svgTop;
      const x2 = toCenter.x - svgLeft;
      const y2 = toCenter.y - svgTop;

      const cy = (y1 + y2) / 2;
      const d = `M ${x1},${y1} C ${x1},${cy} ${x2},${cy} ${x2},${y2}`;
      pathEl.setAttribute('d', d);
    });
  }

  function createPulse(pathSelector) {
    const path = document.querySelector(pathSelector);
    if (!path) return;
    const length = path.getTotalLength();

    const pulseCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pulseCircle.setAttribute('r', '5');
    pulseCircle.setAttribute('fill', '#0081FB');
    svg.appendChild(pulseCircle);

    let start = null;
    const duration = 1500; 

    function animatePulse(timestamp) {
      if (!start) start = timestamp;
      let elapsed = timestamp - start;
      let t = elapsed / duration;
      if (t > 1) {
        svg.removeChild(pulseCircle);
        return;
      }
      const point = path.getPointAtLength(t * length);
      pulseCircle.setAttribute('cx', point.x);
      pulseCircle.setAttribute('cy', point.y);
      requestAnimationFrame(animatePulse);
    }
    requestAnimationFrame(animatePulse);
  }

  setInterval(() => {
    pairs.forEach(p => createPulse(p.path));
  }, 1000);

  window.addEventListener('resize', positionPaths);
  positionPaths();

  // Floating effect
  const extraNodes = document.querySelectorAll('.extra-node');
  const floatingParams = [];
  extraNodes.forEach(node => {
    const amplitudeX = Math.random() * 5 + 2; 
    const amplitudeY = Math.random() * 5 + 2;
    const speedX = Math.random() * 0.002 + 0.001; 
    const speedY = Math.random() * 0.002 + 0.001;
    const phaseX = Math.random() * Math.PI * 2;
    const phaseY = Math.random() * Math.PI * 2;

    floatingParams.push({
      node: node,
      amplitudeX,
      amplitudeY,
      speedX,
      speedY,
      phaseX,
      phaseY
    });
  });

  function floatAnimate(time) {
    floatingParams.forEach(params => {
      const offsetX = Math.sin(time * params.speedX + params.phaseX) * params.amplitudeX;
      const offsetY = Math.sin(time * params.speedY + params.phaseY) * params.amplitudeY;
      params.node.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    requestAnimationFrame(floatAnimate);
  }
  requestAnimationFrame(floatAnimate);

  function initializeGoogleNode(selector, text) {
    const googleBox = document.querySelector(selector);
    if (!googleBox) return;
    const typewriterEl = googleBox.querySelector('.typewriter');

    let index = 0;
    const speed = 100;

    function typeChar() {
      if (index < text.length) {
        typewriterEl.textContent = text.substring(0, index + 1);
        index++;
        setTimeout(typeChar, speed);
      } else {
        typewriterEl.style.borderRight = 'none';
        googleBox.classList.add('show-links');

        // After typing done, wait 2 seconds, then add TikTok node dynamically
        setTimeout(() => {
          addTikTokNode();
        }, 2000);
      }
    }

    typeChar();
  }

  const googleBox = document.getElementById('google-box');
  const queryText = googleBox.getAttribute('data-text') || 'underrated spots in nyc';
  initializeGoogleNode('#google-box', queryText);

  function addTikTokNode() {
    const bottomNodes = document.querySelector('.bottom-nodes');
    if (!bottomNodes) return;

    // Create the TikTok node element
    const tiktokNode = document.createElement('div');
    tiktokNode.className = 'node extra-node tiktok-box';
    tiktokNode.id = 'tiktok-box';
    tiktokNode.innerHTML = `
      <div class="node-header">
        <img class="platform-logo" src="{{ url_for('static', filename='public/tiktok-logo.webp') }}" alt="Tiktok Logo"/>
      </div>
      <img class="platform-img" src="{{ url_for('static', filename='public/tiktok.jpeg') }}" alt="Tiktok Content"/>
    `;
    bottomNodes.appendChild(tiktokNode);

    // Now "spring" it up from the extract node position
    const extractBox = document.querySelector('#extract-box');
    const extractRect = extractBox.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const extractX = extractRect.left + scrollLeft;
    const extractY = extractRect.top + scrollTop;

    // final position as defined by CSS
    const finalRect = tiktokNode.getBoundingClientRect();
    const finalX = finalRect.left + scrollLeft;
    const finalY = finalRect.top + scrollTop;

    // place at extract
    tiktokNode.style.transition = 'none';
    tiktokNode.style.position = 'absolute';
    tiktokNode.style.left = extractX + 'px';
    tiktokNode.style.top = extractY + 'px';
    tiktokNode.style.transform = 'scale(0)';
    tiktokNode.style.opacity = '0';

    // Force reflow
    tiktokNode.offsetHeight;

    // Animate to final position
    setTimeout(() => {
      tiktokNode.style.transition = 'opacity 0.5s ease, transform 0.5s ease, left 0.5s ease, top 0.5s ease';
      tiktokNode.style.left = finalX + 'px';
      tiktokNode.style.top = finalY + 'px';
      tiktokNode.style.opacity = '1';
      tiktokNode.style.transform = 'scale(1)';

      // After animation, update paths
      setTimeout(() => {
        positionPaths();
      }, 600);
    }, 50);
  }

});
