var gaussian = require('gaussian');
var randomInt = require('random-int');

const NUM_EXPERIMENTS = 10;
const NUM_JUDGES = 100


function generateJudge(accuracy, precision) {
	let distribution = gaussian(accuracy, precision);
	return distribution.ppf(Math.random());
}


function generateExperiment(trueVal, externalVal) {
	for(let i=0; i < NUM_JUDGES; i++) {
		let accuracy = randomInt(trueVal, externalVal);
		let leftWidth = accuracy-trueVal;
		let rightWidth = externalVal-accuracy;
		let precision = rightWidth > leftWidth 
			? randomInt(accuracy, externalVal)
			: randomInt(trueVal, accuracy);

		let estimate = generateJudge(accuracy, precision);
		console.log('estimate: ', estimate);
	}
}

module.exports = {
	generateJudge,
	generateExperiment
};
