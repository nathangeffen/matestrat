"use strict";

/*
   Functions to simulate evolution of fatal vs non-fatal mating rituals.
*/

var MALE = 0;
var FEMALE = 1;

var NON_LETHAL = 0;
var LETHAL = 1;

var results;


/*
  Array shuffle function taken from:
  http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
*/
var shuffle = function(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

var output = function(str)
{
    results += "<p>" + str + "</p>";
}

var agent = function(simulation, father, mother)
{
    this.id = simulation.id++;
    this.father = father;
    this.mother = mother;
    this.alive = true;
    if (Math.random() > simulation.prob_male)
	this.sex = MALE;
    else
	this.sex = FEMALE;
    this.mating_genes = [];
    if (father == null) { // First generation
	for (var i = 0; i < simulation.num_mating_genes; ++i) {
	    if (Math.random() < simulation.prop_killer)
		this.mating_genes.push(LETHAL);
	    else
		this.mating_genes.push(NON_LETHAL);
	}
    } else {
	for (var i = 0; i < simulation.num_mating_genes; ++i) {
	    if (Math.random() < 0.5) {
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
    this.expected_seasons_rand = Math.random();
    this.seasons = 0;
    this.birth_iteration = simulation.iteration;
    this.death_iteration = -1;
    this.fights = 0;
    this.victories = 0;
    this.homicides = 0;
    this.children = 0;
    this.matings = 0;
}

var kill_agent = function(simulation, agt, cause)
{
    agt.death_iteration = simulation.iteration;
    agt.cause_of_death = cause;
    ++simulation[cause];
    agt.alive = false;
}

var init_agents = function(simulation)
{
    simulation.agents = []
    for (var i = 0; i < simulation.initial_population; ++i) {
	simulation.agents.push(new agent(simulation, null, null));
    }
    simulation.males = [];
    simulation.females = [];
}

var check_die_old_age = function(simulation, i)
{
    var a = simulation.agents[i];
    if (a.expected_seasons_rand < simulation.expected_seasons[a.seasons]) {
	kill_agent(simulation, simulation.agents[i], "oldage");
    }
}

var battle = function(simulation, i, j)
{
    var winner = 0;
    var loser = 0;
    ++simulation.fights;
    ++simulation.males[i].fights;
    ++simulation.males[j].fights;
    if (Math.random() < 0.5) {
	winner = i;
	loser = j;
    } else {
	winner = j;
	loser = i;
    }
    ++simulation.males[winner].victories;

    if (Math.random() < simulation.males[winner].lethalness) {
	kill_agent(simulation, simulation.males[loser], "homicide");
	++simulation.males[winner].homicides;
	if (Math.random() < simulation.revenge_factor) {
	    kill_agent(simulation, simulation.males[winner], "homicide");
	    ++simulation.males[loser].homicides;
	    winner = -1;
	}
    }

    return winner;
}

var mate = function(simulation, i, j)
{
    ++simulation.males[i].matings;
    ++simulation.females[j].matings;
    for (var k = 0; k < simulation.num_children; ++k) {
	var a = new agent(simulation,
			  simulation.males[i], simulation.females[j]);
	simulation.agents.push(a);
    }
    simulation.males[i].children += simulation.num_children;
    simulation.females[j].children += simulation.num_children;
}

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

var iterate = function(simulation)
{
    jQuery.whileAsync({
        delay: simulation.delay,
        bulk: 0,
        test: function()
	{
	    return simulation.iteration < simulation.iterations &&
		simulation.agents.length > 0 &&
		simulation.agents.length < 20000 &&
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
		check_die_old_age(simulation, i);
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
    results += "<td>" + (simulation.agents.length + simulation.dead.length)
	+ "</td>";
    results += "<td>" + alive + "</td>";
    results += "<td>" + simulation.males.length + "</td>";
    results += "<td>" + peaceful + "</td>";
    results += "<td>" + killer_genes + "</td>";
    results += "<td>" + prop_killer_genes.toFixed(2) + "</td>";
    results += "<td>" + simulation.fights + "</td>";
    results += "<td>" + simulation.homicide + "</td>";
    results += "<td>" + simulation.oldage + "</td>";
    results +="</tr>";

    simulation.agent_time_series.push(simulation.agents.length);
    simulation.peaceful_time_series.push(peaceful);
    simulation.chart_data.series = [simulation.agent_time_series, simulation.peaceful_time_series];
    simulation.chart_data.labels.push(simulation.iteration);

    new Chartist.Line('.ct-chart',
		      simulation.chart_data, simulation.chart_options);

}

var init_results = function()
{
    results = '<table class="results">'
    results += "<tr>";
    results += "<th>#</th>"
    results += "<th>All</th>"
    results += "<th>Alive</th>"
    results += "<th>Males</th>"
    results += "<th>Peaceful</th>"
    results += "<th>Killer genes</th>"
    results += "<th>Proportion</th>"
    results += "<th>Fights</th>"
    results += "<th>Homicides</th>"
    results += "<th>Old age</th>"
    results += "</tr>";
}

var init_weibull = function(simulation)
{
    var p = simulation.discrete_weibull_p;
    var B = simulation.discrete_weibull_B;

    var pdf_discrete_weibull = [];

    var one_minus_p = 1 - p;

    for (var i = 0; i < 100; ++i) {
	var t1 = Math.pow(Math.pow(one_minus_p, i), B);
	var t2 = Math.pow(Math.pow(one_minus_p, i + 1), B);
	pdf_discrete_weibull[i] = t1 - t2;
	if (i > 0)
            pdf_discrete_weibull[i] += pdf_discrete_weibull[i-1];
    }
    simulation.expected_seasons = pdf_discrete_weibull;
}

var finish_results = function()
{
   results += "</table>";
}

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
	    num_mating_genes : parseInt($("#mating_genes").val()),
	    prop_killer : parseFloat($("#homicidal_genes").val()),
	    revenge_factor : parseFloat($("#revenge_factor").val()),
	    discrete_weibull_p : parseFloat($("#discrete_weibull_p").val()),
	    discrete_weibull_B : parseFloat($("#discrete_weibull_B").val()),
	    num_children : parseInt($("#num_kids").val()),
	    delay : parseInt($("#delay").val()),
	    iteration : 0,
	    fights : 0,
	    homicide : 0,
	    oldage : 0,
	    id : 0,
	    dead : [],
	    agent_time_series : [],
	    peaceful_time_series : [],
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
	init_weibull(simulation);
	init_agents(simulation);
	iterate(simulation);
    }
}

$(document).ready(function() {
    $("#simbutton").click(function() {
	simulate();
	$("#output").html(results);
    });
});
