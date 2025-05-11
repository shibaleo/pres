(function () {
  const width = 600;
  const height = 600;

  const canvas = d3.select("canvas").node();
  const context = canvas.getContext("2d");

  const projection = d3.geoOrthographic()
    .scale(300)
    .translate([width / 2, height / 2])
    .clipAngle(90);

  const path = d3.geoPath(projection).context(context);

  const globe = { type: "Sphere" };
  let rotation = [0, 0];
  let velocity = [0.5, -0.1]; // 回転速度を調整（毎33msに合わせて）

  let countries;

  function draw() {
    context.clearRect(0, 0, width, height);

    projection.rotate([rotation[0], rotation[1]]);
    rotation[0] += velocity[0];
    rotation[1] += velocity[1];

    // 地球本体
    context.beginPath();
    path(globe);
    context.fillStyle = "#0077be";
    context.fill();

    // 国の描画
    context.beginPath();
    path(countries);
    context.fillStyle = "#0a0a0a";
    context.fill();

    // 国境線
    context.beginPath();
    path(countries);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 0.3;
    context.stroke();
  }

  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(worldData => {
    countries = topojson.feature(worldData, worldData.objects.countries);

    // 30fpsで描画（低負荷）
    d3.interval(() => {
      draw();
    }, 33); // 約30フレーム/秒

    // マウスドラッグで回転操作
    let lastPos = null;

    d3.select(canvas)
      .call(d3.drag()
        .on("start", event => {
          lastPos = d3.pointer(event);
        })
        .on("drag", event => {
          const pos = d3.pointer(event);
          const dx = pos[0] - lastPos[0];
          const dy = pos[1] - lastPos[1];
          rotation[0] += dx * 0.5;
          rotation[1] -= dy * 0.5;
          lastPos = pos;
        })
        .on("end", () => {
          lastPos = null;
        })
      );
  });
})();
