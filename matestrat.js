"use strict";

/* Javascript to simulate evolution of non-lethal agonistic behaviour in male
 * agents competing for mates.
 */

var MALE = 0;
var FEMALE = 1;

var NON_LETHAL = 0;
var LETHAL = 1;

var results;

// Random number generator;
var rng;

/* Array shuffle function taken from:
 * http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 */
var shuffle = function(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element
    randomIndex = Math.floor(rng.rnd() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

/* Utility function to assist with outputting the table. */

var output = function(str)
{
    results += "<p>" + str + "</p>";
}

/* Creates a new agent. Parameters for father and mother are the ids of the
 * agent's parents. Pass the father and mother as null for first generation.
 */

var agent = function(simulation, father, mother)
{
    this.id = simulation.id++;
    this.father = father;
    this.mother = mother;
    this.alive = true;
    if (rng.rnd() > simulation.prob_male)
	this.sex = MALE;
    else
	this.sex = FEMALE;
    this.mating_genes = [];
    if (father == null) { // First generation
	for (var i = 0; i < simulation.num_mating_genes; ++i) {
	    if (rng.rnd() < simulation.prop_killer)
		this.mating_genes.push(LETHAL);
	    else
		this.mating_genes.push(NON_LETHAL);
	}
    } else {
	for (var i = 0; i < simulation.num_mating_genes; ++i) {
	    if (rng.rnd() < 0.5) {
		this.mating_genes.push(father.mating_genes[i]);
	    } else {
		this.mating_genes.push(mother.mating_genes[i]);
	    }
	}
    }
    var lethalness = 0;
    for (var i = 0; i < this.mating_genes.length; ++i) {
	lethalness += this.mating_genes[i];
    }
    this.lethalness = lethalness / this.mating_genes.length;
    this.expected_seasons_rand = rng.rnd();
    this.seasons = 0;
    this.birth_iteration = simulation.iteration;
    this.death_iteration = -1;
    this.fights = 0;
    this.victories = 0;
    this.homicides = 0;
    this.children = 0;
    this.matings = 0;
}

/* Kills an agent. Parameter agt is the agent to be killed. Cause is a string
 * describing what the cause of death is.
 */

var kill_agent = function(simulation, agt, cause)
{
    agt.death_iteration = simulation.iteration;
    agt.cause_of_death = cause;
    ++simulation[cause];
    agt.alive = false;
}

/* Sets up the initial population of agents at the beginning of the simulation.
 */

var init_agents = function(simulation)
{
    simulation.agents = []
    simulation.males = [];
    simulation.females = [];
    for (var i = 0; i < simulation.initial_population; ++i) {
	var a = new agent(simulation, null, null);
	simulation.agents.push(a);
	if (a.sex == MALE) {
	    simulation.males.push(a);
	} else {
	    simulation.females.push(a);
	}
    }
}

/* Check if the agent is due to die from old age. If so, kill it.
 */

var check_die_old_age = function(simulation, agt)
{
    if (agt.expected_seasons_rand < simulation.expected_seasons[agt.seasons]) {
	kill_agent(simulation, agt, "oldage");
    }
}

/* Pair two male agents in a fight. Parameters i and j are the indices into the
 * males array of the two agents.
 */

var battle = function(simulation, i, j)
{
    var winner = 0;
    var loser = 0;
    ++simulation.fights;
    ++simulation.males[i].fights;
    ++simulation.males[j].fights;
    if (rng.rnd() < 0.5) {
	winner = i;
	loser = j;
    } else {
	winner = j;
	loser = i;
    }
    ++simulation.males[winner].victories;

    if (rng.rnd() < simulation.males[winner].lethalness) {
	kill_agent(simulation, simulation.males[loser], "homicide");
	++simulation.males[winner].homicides;
	if (rng.rnd() < simulation.revenge_factor) {
	    kill_agent(simulation, simulation.males[winner], "homicide");
	    ++simulation.males[loser].homicides;
	    winner = -1;
	}
    }

    return winner;
}

/* Mate two agents. Parameter i is the index in the males array of the male
 * agent to mate, and j is the index to the agent to mate in the females array.
 */

var mate = function(simulation, i, j)
{
    ++simulation.males[i].matings;
    ++simulation.females[j].matings;
    var r = rng.rnd();
    for (var k = 0; k < simulation.expected_children.length &&
	 r >= simulation.expected_children[k]; ++k) {
	var a = new agent(simulation,
			  simulation.males[i], simulation.females[j]);
	simulation.agents.push(a);
    }
    simulation.males[i].children += simulation.num_children;
    simulation.females[j].children += simulation.num_children;
}

/* In monogamous mating, males are paired off against each other to fight.
 * The winner mates, if he survives, mates with one female.
 */

var mating_monogamous = function(simulation)
{
    var j = simulation.males.length - 1;
    var k = simulation.females.length;
    for (var i = 0; i < j && k > 0; ++i) {
	--k;
	var winner = battle(simulation, i, j);
	if (winner >= 0) {
	    mate(simulation, winner, k);
	}
	--j;
    }
}

/* In polygamous mating, males are paired off against each other to fight.  The
 * winner mates with multiple females, equal to the ratio of females to males.
 */

var mating_polygamous = function(simulation)
{
    var j = simulation.males.length - 1;
    var k = simulation.females.length;
    var num_mates_per_male = Math.max(k / j, 1);
    for (var i = 0; i < j && k > 0; ++i) {
	var winner = battle(simulation, i, j);
	if (winner >= 0) {
	    for (var l = 0; l < num_mates_per_male; ++l) {
		--k;
		mate(simulation, winner, k);
	    }
	}
	--j;
    }
}

/* Removes dead agents from the agents array and puts them into the dead array.
 */

var remove_dead = function(simulation)
{
    var alive_agents = [];
    for (var i = 0; i < simulation.agents.length; ++i) {
	var a = simulation.agents[i];
	if (a.alive) {
	    alive_agents.push(a);
	} else {
	    simulation.dead.push(a);
	}
    }
    simulation.agents = alive_agents;
}

/* This is the timer bound main loop of the simulation, in which iteration
 * corresponds to a mating season.
 */

var iterate = function(simulation)
{
    jQuery.whileAsync({
        delay: simulation.delay,
        bulk: 0,
        test: function()
	{
	    return simulation.iteration < simulation.iterations &&
		simulation.agents.length > 0 &&
		simulation.agents.length < simulation.max_population &&
		!$("#simbutton").hasClass("StopSim");
	},
        loop: function()
        {
	    report(simulation);
	    var out = results +"</table>";
	    $("#output").html(out);
	    simulation.males = [];
	    simulation.females = [];
	    for (var i = 0; i < simulation.agents.length; ++i) {
		check_die_old_age(simulation, simulation.agents[i]);
		++simulation.agents[i].seasons;
		if (simulation.agents[i].alive) {
		    if (simulation.agents[i].sex == MALE) {
			simulation.males.push(simulation.agents[i]);
		    } else {
			simulation.females.push(simulation.agents[i]);
		    }
		}
	    }
	    shuffle(simulation.males);
	    shuffle(simulation.females);
	    simulation.mating(simulation);
	    remove_dead(simulation);
	    ++simulation.iteration;
        },
        end: function()
        {
	    report(simulation);
	    results += "</table>";
	    $("#output").html(results + "<hr />");
	    $("#simbutton").removeClass("InSim StopSim");
	    $("#simbutton").text("Simulate");
        }
    });
}


/*
 * Outputs the graph and table at the end of each iteration of the simulation
 * (as well as once at the beginning, after initialisation).
 */

var report = function(simulation)
{
    var alive = simulation.agents.length;
    var prop_killer_genes;
    var peaceful = 0;
    var homicidal = 0;
    var killer_genes = 0;
    for (var i = 0; i < alive; ++i) {
	var a = simulation.agents[i];
	var k = 0;
	for (var j = 0; j < simulation.num_mating_genes; ++j) {
	    killer_genes += a.mating_genes[j];
	    k += a.mating_genes[j];
	}
	if (k < simulation.prop_killer * simulation.num_mating_genes) {
	    ++peaceful;
	} else {
	    ++homicidal;
	}
    }

    prop_killer_genes = killer_genes / (simulation.num_mating_genes * alive);

    results += "<tr>";
    results += "<td>" + simulation.iteration + "</td>";
    results += "<td>" + alive + " (" + simulation.females.length
	+ ")" +	"</td>";
    results += "<td>" + peaceful + "</td>";
    results += "<td>" + prop_killer_genes.toFixed(2) + "</td>";
    results += "<td>" + simulation.homicide + "</td>";
    results += "<td>" + simulation.oldage + "</td>";
    results +="</tr>";

    simulation.agent_time_series.push(simulation.agents.length);
    simulation.peaceful_time_series.push(peaceful);
    simulation.chart_data.series = [simulation.agent_time_series,
				    simulation.peaceful_time_series];
    simulation.chart_data.labels.push(simulation.iteration);

    new Chartist.Line('.ct-chart',
		      simulation.chart_data, simulation.chart_options);

}

/* Prepares table for output.
 */

var init_results = function()
{
    results = '<table class="results">';
    results += "<tr>";
    results += "<th>#</th>";
    results += "<th>Alive (female)</th>";
    results += "<th>Peaceful</th>";
    results += "<th>Proportion</th>";
    results += "<th>Deaths<br/>homicide</th>";
    results += "<th>Deaths<br/>old age</th>";
    results += "</tr>";
}

/* A table of factorials is calculated to assist with
 * binomial distribution calculations.
 */

var calc_factorial_table = function(n)
{
    var table = [1, 1];
    var total = 1;
    for (var i = 2; i <= n; ++i) {
	total *= i;
	table.push(total);
    }
    return table;
}

/* Uses the binomial mass function to calculate the probability of k successes
 * out of n attempts where each attempt has probability p.
 */

var binomial_mf = function(n, k, p, factorial_table)
{
    var n_f = factorial_table[n];
    var k_f = factorial_table[k];
    var n_k_f = factorial_table[n-k];
    var t0 = n_f / (k_f * n_k_f);
    var t1 = Math.pow(p, k);
    var t2 = Math.pow(1-p, n-k);
    var ans = t0 * t1 * t2;
    return ans;
}

/* Calculates the cumulative density function for the binomial distribution,
 * where n is the number of attempts and p is the chance of success for each
 * attempt.
 */

var binomial_cdf_table = function(n, p)
{
    var fact_table = calc_factorial_table(n);
    var table = [];
    for (var k = 0; k <= n; ++k) {
	table.push(binomial_mf(n, k, p, fact_table));
    }
    for (var i = 1; i < table.length; ++i) {
	table[i] += table[i-1];
    }
    return table;
}

/* Initialises a table for the binomial distribution if the user selected
 * the binomial distribution to model child births.
 */

var init_binomial_children = function(simulation)
{
    simulation.expected_children =
	binomial_cdf_table(simulation.num_children_binom_n,
			   simulation.num_children_binom_p);
}

/* Initialises a table that will ensure a fixed number of births occur per
 * mating, if the user selected a fixed number of births per mating.
 */

var init_fixed_children = function(simulation)
{
    simulation.expected_children = [];
    for (var i = 0; i <= simulation.num_children_fixed; ++i) {
	simulation.expected_children.push(0);
    }
}

/* Calculates the mean number of seasons agents will live if the discrete
 * Weibull distribution is used.
 */

var avg_weibull = function(simulation)
{
    var p = $("#discrete_weibull_p").val();
    var B = $("#discrete_weibull_B").val();

    var total = 0.0;
    for (var x = 0; x < 100; ++x) {
	var t1 = Math.pow(Math.pow((1 - p), x), B);
	var t2 = Math.pow(Math.pow((1 - p), x + 1), B);
	total += (t1 - t2) * x;
    }
    return total.toFixed(1);
}

/* Initialize the simulation to manage deaths using the Discrete Weibull
 * function if the user selects it.
 */

var init_weibull = function(simulation)
{
    var p = simulation.discrete_weibull_p;
    var B = simulation.discrete_weibull_B;

    var cdf_discrete_weibull = [];

    for (var i = 0; i < 100; ++i) {
	var t1 = 1 - p;
	var t2 = i + 1;
	var t3 = Math.pow(t2, B);
	var t4 = Math.pow(t1, t3);
	var t5 = 1 - t4;
	cdf_discrete_weibull.push(t5);
    }
    simulation.expected_seasons = cdf_discrete_weibull;
}

/* Initialize the simulation to manage deaths using a fixed number of seasons
 * if the user selects it.
 */

var init_fixed_seasons = function(simulation)
{
    var s = simulation.fixed_seasons;
    var pdf_fixed_seasons = [];
    for (var i = 0; i < 100; ++i) {
	if (i < s) {
	    pdf_fixed_seasons.push(0.0);
	} else {
	    pdf_fixed_seasons.push(1.0);
	}
    }
    simulation.expected_seasons = pdf_fixed_seasons;
}

/* Called to close the results table by the report function. */

var finish_results = function()
{
   results += "</table>";
}

/* Gets all the simulation parameters from the browser and starts the
 * simulation.
 */

var simulate = function()
{
    if ($("#simbutton").hasClass('InSim')) {
	$("#simbutton").addClass('StopSim');
    } else {
	$("#simbutton").addClass("InSim");
	$("#simbutton").text("Stop simulation");
	var simulation = {
	    iterations : parseInt($("#iterations").val()),
	    initial_population : parseInt($("#population").val()),
	    prob_male : 0.5,
	    max_population : parseInt($("#max_population").val()),
	    num_mating_genes : parseInt($("#mating_genes").val()),
	    prop_killer : parseFloat($("#homicidal_genes").val()),
	    revenge_factor : parseFloat($("#revenge_factor").val()),
	    fixed_seasons : parseInt($("#fixed_seasons").val()),
	    discrete_weibull_p : parseFloat($("#discrete_weibull_p").val()),
	    discrete_weibull_B : parseFloat($("#discrete_weibull_B").val()),
	    num_children_fixed : parseInt($("#num_kids").val()),
	    num_children_binom_n : parseFloat($("#num_children_binom-n").val()),
	    num_children_binom_p : parseFloat($("#num_children_binom-p").val()),
	    delay : parseInt($("#delay").val()),
	    iteration : 0,
	    fights : 0,
	    homicide : 0,
	    oldage : 0,
	    id : 0,
	    dead : [],
	    agent_time_series : [],
	    peaceful_time_series : []
	};
	if ($("#mating_strategy").val() == "monogamous") {
	    simulation.mating = mating_monogamous;
	} else {
	    simulation.mating = mating_polygamous;
	}


	simulation.chart_data = {
	    labels: [],
	    series: []
	};
	simulation.chart_options = {
	    lineSmooth : false,
	    axisY: {  offset: 40 }
	};
	init_results();
	if ($('#mating_weibull').is(':checked')) {
	    init_weibull(simulation);
	} else {
	    init_fixed_seasons(simulation);
	}
	if ($('#children_binom').is(':checked')) {
	    init_binomial_children(simulation);
	} else {
	    init_fixed_children(simulation);
	}
	if ($('#rng-javascript').is(':checked')) {
	    rng = new Object();
	    rng.rnd = Math.random;
	} else {
	    if (typeof rng == "undefined" ||
		typeof rng.mersenneSet === "undefined") {
		var seed = parseInt($('#seed'));
		rng = new MersenneTwister(seed);
		rng.mersenneSet = new Object();
	    }
	}

	init_agents(simulation);
	iterate(simulation);
    }
}

$.validator.setDefaults({
    submitHandler: function() {
	simulate();
	$("#output").html(results);
    }
});

$(document).ready(function() {
    $('#avg-seasons').text(avg_weibull());

    $("#parameters-form").validate();

});
