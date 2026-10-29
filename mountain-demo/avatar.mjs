// Keep the original sleeve vertices and their arm weights. Flattening every low
// jacket vertex also flattens the cuffs and tethers them to the hips when posing.
export function createSleeveGeometry(source,boneNames) {
  const geometry=source.clone();
  const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  const position=geometry.getAttribute('position'),index=geometry.getIndex();
  const armJoints=new Set(boneNames.map((name,i)=>/^(Left|Right)(Shoulder|Arm|ForeArm|Hand)$/.test(name)?i:-1));
  const armWeight=i=> {
    let total=0;
    for(let component=0;component<4;component++) {
      if(armJoints.has(joints.getComponent(i,component))) total+=weights.getComponent(i,component);
    }
    return total;
  };
  const indices=[];
  for(let i=0;i<index.count;i+=3) {
    const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const influence=ids.reduce((sum,id)=>sum+armWeight(id),0)/3;
    if(influence>.16&&ids.every(id=>Math.abs(position.getX(id))>.11)) indices.push(...ids);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
