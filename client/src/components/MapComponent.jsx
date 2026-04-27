import { useEffect, useRef } from 'react';

function getSPEIColor(spei) {
  if (spei >= 1.0)  return '#3b82f6';
  if (spei >= -1.0) return '#1ABC9C';
  if (spei >= -1.5) return '#F39C12';
  if (spei >= -2.0) return '#e67e22';
  return '#E74C3C';
}

// Nigeria bounding box: lat 4–14.5, lng 2.5–15.5
function project(lat, lng, w, h) {
  const x = ((lng - 2.5) / 13.0) * (w - 40) + 20;
  const y = h - ((lat - 4.0) / 10.5) * (h - 40) - 20;
  return { x, y };
}

export default function MapComponent({ states = [], onStateClick }) {
  const canvasRef  = useRef(null);
  const hoveredRef = useRef(null);

  function draw(hoveredPcode) {
    const canvas = canvasRef.current;
    if (!canvas || !states.length) return;
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    states.forEach(state => {
      const { x, y } = project(state.lat, state.lng, w, h);
      const color    = getSPEIColor(state.spei ?? state.current_spei ?? 0);
      const isHover  = hoveredPcode === state.pcode;
      const r        = isHover ? 13 : 9;

      // Glow ring on hover
      if (isHover) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 26);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer translucent ring
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();

      // Solid dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isHover ? '#ffffff' : color + 'aa';
      ctx.lineWidth   = isHover ? 2 : 1;
      ctx.stroke();

      // Tooltip label on hover
      if (isHover) {
        const predVal = Number.isFinite(state.spei) ? state.spei.toFixed(2) : '—';
        const realVal = Number.isFinite(state.current_spei) ? state.current_spei.toFixed(2) : '—';
        ctx.font      = 'bold 12px DM Sans, sans-serif';
        ctx.fillStyle = '#e8f4f8';
        ctx.textAlign = 'center';
        ctx.fillText(state.name, x, y - r - 8);
        ctx.font      = '11px DM Sans, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(`Pred: ${predVal}  Real: ${realVal}`, x, y - r - 22);
      }
    });
  }

  useEffect(() => { draw(null); }, [states]);

  function getHovered(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    for (const s of states) {
      const { x, y } = project(s.lat, s.lng, canvas.width, canvas.height);
      if (Math.hypot(mx - x, my - y) < 14) return s;
    }
    return null;
  }

  function handleMouseMove(e) {
    const found = getHovered(e);
    const pcode = found ? found.pcode : null;
    if (pcode !== hoveredRef.current) {
      hoveredRef.current = pcode;
      canvasRef.current.style.cursor = pcode ? 'pointer' : 'default';
      draw(pcode);
    }
  }

  function handleClick(e) {
    const found = getHovered(e);
    if (found) onStateClick && onStateClick(found);
  }

  return (
    <canvas
      ref={canvasRef}
      width={600} height={480}
      style={{ width:'100%', height:'100%', display:'block', background:'transparent' }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    />
  );
}
