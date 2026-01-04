run:
	npm install
	node run.js --inst $(inst) --algo $(algo) --reps $(reps)

exp:
	npm install
	node scripts/exp.js
