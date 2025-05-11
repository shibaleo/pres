(function () {
	var img_w = 600
	var img_h = 300
var svg_cont = d3.select("#bar-chart")
	.append("svg")
	.attr("width",img_w)
	.attr("height",img_h);
var list = [30,10,20,80,100,40,70,90,60,50];
var x_min = (img_w-list.length*48)/2;
var rect = svg_cont.append("g")
	.selectAll("rect")
	.data(list)
	.enter()
	.append("rect")
	.attr("height",function(d){return  d*2;})
	.attr("width",44)
	.attr("x",function(d,i){return x_min + i * 48;})
	.attr("y",function(d){return (img_h - (d*2));})
	.attr("fill","#4360f4").attr("stroke","#4360f4")
	.attr("stroke-width",2);
})();