const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(value,start,end)=> {
  const t=clamp((value-start)/(end-start));
  return t*t*(3-2*t);
};

// Add descending bends as chapters are added, keeping a flat summit and arrival.
export function createTrailPoints(chapterCount=11) {
  const bends=Math.max(20,Math.ceil(chapterCount)*2);
  const points=[[-.8,2,-1.8],[-.72,2,-1.25]];
  for(let i=1;i<=bends;i++) {
    points.push([-.72+.8*Math.sin(i*.42),2-i*.48,-1.25+i*.9]);
  }
  const [x,y,z]=points[points.length-1];
  points.push([x+.15,y-.14,z+.65],[x+.2,y-.14,z+1.25]);
  return points;
}

// Climate belongs to a location on the trail, so returning uphill restores snow.
export function trailClimate(progress) {
  const p=clamp(progress);
  return {snow:1-smooth(p,.12,.54),green:smooth(p,.30,.88)};
}
