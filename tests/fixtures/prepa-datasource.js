const dataFechaAcualizado = '9/20/2026 7:22:21 AM';
const dataFuelCost = [
	{place: 'San Juan', value: 113},
	{place: 'San Juan CC', value: 176},
	{place: 'Palo Seco', value: 111},
	{place: 'Aguirre', value: 111},
	{place: 'Aguirre CC', value: 147},
	{place: 'Costa Sur', value: 100},
	{place: 'Cambalache', value: 172},
	{place: 'Mayaguez', value: 165},
	{place: 'Costa Sur LNG', value: 9},
];

const dataByFuel = [
	{fuel: 'Bunker', value: 19},
	{fuel: 'Diesel', value: 14},
	{fuel: 'LNG', value: 45},
	{fuel: 'Coal', value: 21},
	{fuel: 'Renew', value: 1},
];

const dataMetrics = [
	{Index: '0', Desc: 'Total de Generación', value: 2040},
	{Index: '1', Desc: 'PREPA', value: 57},
	{Index: '2', Desc: 'PPOA', value: 43},
	{Index: '3', Desc: 'Fossil', value: 99},
	{Index: '4', Desc: 'Renewable', value: 1},
	{Index: '5', Desc: 'Reserva en Rotación', value: 698},
	{Index: '6', Desc: 'Reserva Operacional', value: 1339},
	{Index: '7', Desc: 'Capacidad Disponible', value: 3378},
	{Index: '8', Desc: 'Próxima Hora MW', value: 1950},
	{Index: '9', Desc: 'Máxima para Hoy', value: 2456},
	{Index: '10', Desc: 'Máxima Mensual', value: 3138},
	{Index: '11', Desc: 'Máxima Anual', value: 3234},
	{Index: '12', Desc: 'Máxima para Hoy TS', value: '9/20/2026 4:00:00 AM'},
	{Index: '13', Desc: 'Máxima para Hoy TS', value: '9/10/2026 11:53:33 PM'},
	{Index: '14', Desc: 'Máxima Anual TS', value: '8/18/2026 11:59:51 PM'},
];

const dataLoadPerSite = [
	{Index: '0', Type: 'Hidroelectricas', Desc: 'Dos Bocas', SiteTotal: 0, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '0'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '0'},
		{Index: '2', Unit: 'Hidro 3', MW: 0, MVar: 0, Cost: 0, ParentId: '0'},
	]},
	{Index: '1', Type: 'Hidroelectricas', Desc: 'Caonillas', SiteTotal: 0, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '1'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '1'},
	]},
	{Index: '2', Type: 'Hidroelectricas', Desc: 'Garzas', SiteTotal: 0, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '2'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '2'},
		{Index: '2', Unit: 'Hidro 3', MW: 0, MVar: 0, Cost: 0, ParentId: '2'},
	]},
	{Index: '3', Type: 'Hidroelectricas', Desc: 'Rio Blanco', SiteTotal: 0, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '3'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '3'},
	]},
	{Index: '4', Type: 'Hidroelectricas', Desc: 'Toro Negro', SiteTotal: 0, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '4'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '4'},
		{Index: '2', Unit: 'Hidro 3', MW: 0, MVar: 0, Cost: 0, ParentId: '4'},
		{Index: '3', Unit: 'Hidro 4', MW: 0, MVar: 0, Cost: 0, ParentId: '4'},
		{Index: '4', Unit: 'Hidro 5', MW: 0, MVar: 0, Cost: 0, ParentId: '4'},
	]},
	{Index: '5', Type: 'Hidroelectricas', Desc: 'Yauco', SiteTotal: 1.86, units: [
		{Index: '0', Unit: 'Hidro 1', MW: 0, MVar: 0, Cost: 0, ParentId: '5'},
		{Index: '1', Unit: 'Hidro 2', MW: 0, MVar: 0, Cost: 0, ParentId: '5'},
		{Index: '2', Unit: 'Hidro 3', MW: 1.88, MVar: 0.22, Cost: 0, ParentId: '5'},
	]},
	{Index: '6', Type: 'COGEN', Desc: 'AES', SiteTotal: 423, units: [
		{Index: '0', Unit: 'Unit 1', MW: 202, MVar: 61, Cost: 6.48, ParentId: '6'},
		{Index: '1', Unit: 'Unit 2', MW: 220, MVar: 68, Cost: 6.48, ParentId: '6'},
	]},
	{Index: '7', Type: 'COGEN', Desc: 'Ecoelectrica', SiteTotal: 442, units: [
		{Index: '0', Unit: 'Gas 1', MW: 150.29, MVar: 26, Cost: 6.8, ParentId: '7'},
		{Index: '1', Unit: 'Gas 2', MW: 150.47, MVar: 28, Cost: 6.8, ParentId: '7'},
		{Index: '2', Unit: 'STG', MW: 139.8, MVar: 139, Cost: 6.8, ParentId: '7'},
	]},
	{Index: '8', Type: 'Turbina de Gas', Desc: 'Estaciones GT', SiteTotal: 0.05, units: [
		{Index: '0', Unit: 'Palo Seco', MW: 0, MVar: 0, Cost: 0, ParentId: '8'},
		{Index: '1', Unit: 'Vega Baja', MW: 0, MVar: 0, Cost: 0, ParentId: '8'},
		{Index: '2', Unit: 'Costa Sur', MW: 0, MVar: 0.07, Cost: 0, ParentId: '8'},
		{Index: '3', Unit: 'Jobos', MW: 0.04, MVar: -0.05, Cost: 0, ParentId: '8'},
		{Index: '4', Unit: 'Daguao', MW: 0, MVar: -0.09, Cost: 0, ParentId: '8'},
		{Index: '5', Unit: 'Yabucoa', MW: 0, MVar: 0, Cost: 0, ParentId: '8'},
		{Index: '6', Unit: 'Aguirre', MW: 0, MVar: 0, Cost: 0, ParentId: '8'},
		{Index: '7', Unit: 'FEMA GT PS', MW: 0, MVar: 0, Cost: 16, ParentId: '8'},
		{Index: '8', Unit: 'FEMA GT SJ', MW: 0, MVar: 0, Cost: 16, ParentId: '8'},
	]},
	{Index: '9', Type: 'Turbina de Gas', Desc: 'Mayaguez', SiteTotal: 0.1, units: [
		{Index: '0', Unit: 'Gas 1', MW: 0, MVar: 0, Cost: 0, ParentId: '9'},
		{Index: '1', Unit: 'Gas 2', MW: 0, MVar: 0, Cost: 0, ParentId: '9'},
		{Index: '2', Unit: 'Gas 3', MW: 0.1, MVar: 0.1, Cost: 0, ParentId: '9'},
		{Index: '3', Unit: 'Gas 4', MW: 0, MVar: -0.1, Cost: 0, ParentId: '9'},
	]},
	{Index: '10', Type: 'Turbina de Gas', Desc: 'Cambalache', SiteTotal: 4.43, units: [
		{Index: '0', Unit: 'Gas 1', MW: 0, MVar: 0.2, Cost: 0, ParentId: '10'},
		{Index: '1', Unit: 'Gas 2', MW: 0, MVar: 0, Cost: 0, ParentId: '10'},
		{Index: '2', Unit: 'Gas 3', MW: 4.43, MVar: 0, Cost: 0, ParentId: '10'},
	]},
	{Index: '11', Type: 'Ciclo Combinado', Desc: 'San Juan', SiteTotal: 275.91, units: [
		{Index: '0', Unit: 'CTG 5', MW: 119.4, MVar: 35.4, Cost: 24.64, ParentId: '11'},
		{Index: '1', Unit: 'STG 5', MW: 36.61, MVar: 7.97, Cost: 24.64, ParentId: '11'},
		{Index: '2', Unit: 'CTG 6', MW: 119.7, MVar: 36.8, Cost: 32.39, ParentId: '11'},
		{Index: '3', Unit: 'STG 6', MW: 0, MVar: 0, Cost: 32.39, ParentId: '11'},
	]},
	{Index: '12', Type: 'Ciclo Combinado', Desc: 'Aguirre Stag 1', SiteTotal: 0.38, units: [
		{Index: '0', Unit: 'Gas 1', MW: 0.09, MVar: 0, Cost: 0, ParentId: '12'},
		{Index: '1', Unit: 'Gas 2', MW: 0.09, MVar: -2.08, Cost: 0, ParentId: '12'},
		{Index: '2', Unit: 'Gas 3', MW: 0, MVar: 0, Cost: 0, ParentId: '12'},
		{Index: '3', Unit: 'Gas 4', MW: 0.19, MVar: 0.09, Cost: 0, ParentId: '12'},
		{Index: '4', Unit: 'STG 1', MW: 0, MVar: 0, Cost: 0, ParentId: '12'},
	]},
	{Index: '13', Type: 'Ciclo Combinado', Desc: 'Aguirre Stag 2', SiteTotal: 0.09, units: [
		{Index: '0', Unit: 'Gas 1', MW: 0, MVar: 0, Cost: 0, ParentId: '13'},
		{Index: '1', Unit: 'Gas 2', MW: 0.09, MVar: 0, Cost: 0, ParentId: '13'},
		{Index: '2', Unit: 'Gas 3', MW: 0, MVar: 0, Cost: 0, ParentId: '13'},
		{Index: '3', Unit: 'Gas 4', MW: 0, MVar: -0.09, Cost: 0, ParentId: '13'},
		{Index: '4', Unit: 'STG 2', MW: 0, MVar: 0, Cost: 0, ParentId: '13'},
	]},
	{Index: '14', Type: 'Vapor', Desc: 'San Juan', SiteTotal: 0.07, units: [
		{Index: '0', Unit: 'Unit 7', MW: 0.07, MVar: 0, Cost: 0, ParentId: '14'},
		{Index: '1', Unit: 'Unit 8', MW: 0.07, MVar: 0, Cost: 0, ParentId: '14'},
		{Index: '2', Unit: 'Unit 9', MW: 0.07, MVar: 0, Cost: 0, ParentId: '14'},
		{Index: '3', Unit: 'Unit 10', MW: -0.07, MVar: 0, Cost: 0, ParentId: '14'},
	]},
	{Index: '15', Type: 'Vapor', Desc: 'Palo Seco', SiteTotal: 230, units: [
		{Index: '0', Unit: 'Unit 1', MW: 0, MVar: 0, Cost: 0, ParentId: '15'},
		{Index: '1', Unit: 'Unit 2', MW: 0, MVar: 0, Cost: 0, ParentId: '15'},
		{Index: '2', Unit: 'Unit 3', MW: 130.05, MVar: 43.5, Cost: 17.77, ParentId: '15'},
		{Index: '3', Unit: 'Unit 4', MW: 99.61, MVar: 29.2, Cost: 19.01, ParentId: '15'},
	]},
	{Index: '16', Type: 'Vapor', Desc: 'Aguirre', SiteTotal: 164.47, units: [
		{Index: '0', Unit: 'Unit 1', MW: 0, MVar: 0.3, Cost: 0, ParentId: '16'},
		{Index: '1', Unit: 'Unit 2', MW: 159.45, MVar: 101.87, Cost: 20.46, ParentId: '16'},
	]},
	{Index: '17', Type: 'Vapor', Desc: 'Costa Sur', SiteTotal: 478.52, units: [
		{Index: '0', Unit: 'Unit 3', MW: 0.06, MVar: -0.06, Cost: 0, ParentId: '17'},
		{Index: '1', Unit: 'Unit 4', MW: 0.06, MVar: 0, Cost: 0, ParentId: '17'},
		{Index: '2', Unit: 'Unit 5', MW: 202.4, MVar: 38.1, Cost: 11.09, ParentId: '17'},
		{Index: '3', Unit: 'Unit 6', MW: 275, MVar: 41.7, Cost: 9.77, ParentId: '17'},
	]},
	{Index: '18', Type: 'Renovable', Desc: 'Wind', SiteTotal: 1.5, units: [
		{Index: '0', Unit: 'Pattern', MW: 1.4, MVar: 1, Cost: 16.29, ParentId: '18'},
		{Index: '1', Unit: 'Punta Lima', MW: 0.1, MVar: 0.5, Cost: 0, ParentId: '18'},
	]},
	{Index: '19', Type: 'Renovable', Desc: 'Solar', SiteTotal: 19.78, units: [
		{Index: '0', Unit: 'San Fermin', MW: 0.91, MVar: 0.7, Cost: 0, ParentId: '19'},
		{Index: '1', Unit: 'Ilumina', MW: 2.56, MVar: -9.23, Cost: 21.43, ParentId: '19'},
		{Index: '2', Unit: 'Horizon', MW: 1.81, MVar: -1.56, Cost: 19.6, ParentId: '19'},
		{Index: '3', Unit: 'Coto Laurel', MW: 1.37, MVar: 3.14, Cost: 19.1, ParentId: '19'},
		{Index: '4', Unit: 'Oriana', MW: 5.93, MVar: 28.73, Cost: 19.6, ParentId: '19'},
		{Index: '5', Unit: 'Fonroche', MW: 4.88, MVar: 4.33, Cost: 17, ParentId: '19'},
	]},
	{Index: '20', Type: 'Renovable', Desc: 'Landfill', SiteTotal: 1.78, units: [
		{Index: '0', Unit: 'Toa Baja', MW: 0.58, MVar: 0, Cost: 0, ParentId: '20'},
		{Index: '1', Unit: 'Fajardo', MW: 1.2, MVar: -0.62, Cost: 10, ParentId: '20'},
	]},
	{Index: '21', Type: 'Turbina de Gas', Desc: 'Palo Seco', SiteTotal: 0, units: [
		{Index: '0', Unit: 'CT Block 1', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '1', Unit: 'CT Block 2', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '2', Unit: 'CT Block 3', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '3', Unit: 'GT1', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '4', Unit: 'GT2', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '5', Unit: 'GT3', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '6', Unit: 'GT4', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '7', Unit: 'GT5', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
		{Index: '8', Unit: 'GT6', MW: 0, MVar: 0, Cost: 0, ParentId: '21'},
	]},
	{Index: '22', Type: 'Turbina de Gas', Desc: 'Aguirre', SiteTotal: 0, units: [
		{Index: '0', Unit: 'GT1', MW: 0, MVar: 0, Cost: 0, ParentId: '22'},
		{Index: '1', Unit: 'GT2', MW: 0, MVar: 0, Cost: 0, ParentId: '22'},
	]},
	{Index: '23', Type: 'Turbina de Gas', Desc: 'Costa Sur', SiteTotal: 0, units: [
		{Index: '0', Unit: 'GT1', MW: 0, MVar: 0, Cost: 18.55, ParentId: '23'},
		{Index: '1', Unit: 'GT2', MW: 0, MVar: 0, Cost: 0, ParentId: '23'},
	]},
];
