function speiCategory(v) {
  if (v >= 2.0)  return {label:'Extremely Wet',    color:'#1e40af',severity:0};
  if (v >= 1.5)  return {label:'Very Wet',         color:'#3b82f6',severity:1};
  if (v >= 1.0)  return {label:'Moderately Wet',   color:'#60a5fa',severity:2};
  if (v >= -1.0) return {label:'Near Normal',      color:'#1ABC9C',severity:3};
  if (v >= -1.5) return {label:'Moderate Drought', color:'#F39C12',severity:4};
  if (v >= -2.0) return {label:'Severe Drought',   color:'#e67e22',severity:5};
  return               {label:'Extreme Drought',  color:'#E74C3C',severity:6};
}
module.exports = { speiCategory };
