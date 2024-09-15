# complie stylesheet
npx sass ./styles/css/custom.scss ./styles/css/custom.css
# render html
npx asciidoctor-revealjs pres.adoc
# add plugin configuations
sed -i "s/<script>window.MathJax = {/<script>window.MathJax = {\"chtml\": { displayAlign: \"left\" },/g" ./pres.html
sed -i '/Reveal.initialize({/r ./insert.txt' ./pres.html