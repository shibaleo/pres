npx sass ./styles/css/custom.scss ./styles/css/custom.css
npx asciidoctor-revealjs slides.adoc
#sed -i '/Reveal.initialize({/r ./insert.txt' ./slides.html