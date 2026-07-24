export type CityLocation = {
  id: string;
  name: string;
  province: string;
  district: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

export const PAKISTAN_CITIES: CityLocation[] = [
  {
    id: "lahore",
    name: "Lahore",
    province: "Punjab",
    district: "Lahore District",
    latitude: 31.5204,
    longitude: 74.3587,
    aliases: ["lahore", "lhr", "lahore city"],
  },
  {
    id: "karachi",
    name: "Karachi",
    province: "Sindh",
    district: "Karachi Division",
    latitude: 24.8607,
    longitude: 67.0011,
    aliases: ["karachi", "khi", "karachi city"],
  },
  {
    id: "islamabad",
    name: "Islamabad",
    province: "Islamabad Capital Territory",
    district: "Islamabad District",
    latitude: 33.6844,
    longitude: 73.0479,
    aliases: ["islamabad", "isb", "capital"],
  },
  {
    id: "rawalpindi",
    name: "Rawalpindi",
    province: "Punjab",
    district: "Rawalpindi District",
    latitude: 33.5651,
    longitude: 73.0169,
    aliases: ["rawalpindi", "pindi", "rwp"],
  },
  {
    id: "peshawar",
    name: "Peshawar",
    province: "Khyber Pakhtunkhwa",
    district: "Peshawar District",
    latitude: 34.0151,
    longitude: 71.5249,
    aliases: ["peshawar", "pew"],
  },
  {
    id: "quetta",
    name: "Quetta",
    province: "Balochistan",
    district: "Quetta District",
    latitude: 30.1798,
    longitude: 66.9750,
    aliases: ["quetta", "uet"],
  },
  {
    id: "multan",
    name: "Multan",
    province: "Punjab",
    district: "Multan District",
    latitude: 30.1575,
    longitude: 71.5249,
    aliases: ["multan", "mux"],
  },
  {
    id: "faisalabad",
    name: "Faisalabad",
    province: "Punjab",
    district: "Faisalabad District",
    latitude: 31.4504,
    longitude: 73.1350,
    aliases: ["faisalabad", "lyallpur", "fsd"],
  },
  {
    id: "gujranwala",
    name: "Gujranwala",
    province: "Punjab",
    district: "Gujranwala District",
    latitude: 32.1877,
    longitude: 74.1945,
    aliases: ["gujranwala", "gjw"],
  },
  {
    id: "sialkot",
    name: "Sialkot",
    province: "Punjab",
    district: "Sialkot District",
    latitude: 32.4945,
    longitude: 74.5229,
    aliases: ["sialkot", "skt"],
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    province: "Sindh",
    district: "Hyderabad District",
    latitude: 25.3960,
    longitude: 68.3578,
    aliases: ["hyderabad", "hyd"],
  },
  {
    id: "sukkur",
    name: "Sukkur",
    province: "Sindh",
    district: "Sukkur District",
    latitude: 27.7131,
    longitude: 68.8492,
    aliases: ["sukkur", "skr"],
  },
  {
    id: "larkana",
    name: "Larkana",
    province: "Sindh",
    district: "Larkana District",
    latitude: 27.5580,
    longitude: 68.2080,
    aliases: ["larkana", "lrk"],
  },
  {
    id: "abbottabad",
    name: "Abbottabad",
    province: "Khyber Pakhtunkhwa",
    district: "Abbottabad District",
    latitude: 34.1688,
    longitude: 73.2215,
    aliases: ["abbottabad", "atd"],
  },
  {
    id: "gilgit",
    name: "Gilgit",
    province: "Gilgit-Baltistan",
    district: "Gilgit District",
    latitude: 35.9208,
    longitude: 74.3089,
    aliases: ["gilgit", "glt"],
  },
  {
    id: "skardu",
    name: "Skardu",
    province: "Gilgit-Baltistan",
    district: "Skardu District",
    latitude: 35.2979,
    longitude: 75.6337,
    aliases: ["skardu", "kdu"],
  },
  {
    id: "muzaffarabad",
    name: "Muzaffarabad",
    province: "Azad Jammu & Kashmir",
    district: "Muzaffarabad District",
    latitude: 34.3700,
    longitude: 73.4711,
    aliases: ["muzaffarabad", "mzd"],
  },
  {
    id: "gwadar",
    name: "Gwadar",
    province: "Balochistan",
    district: "Gwadar District",
    latitude: 25.1264,
    longitude: 62.3225,
    aliases: ["gwadar", "gwd"],
  },
  {
    id: "chaman",
    name: "Chaman",
    province: "Balochistan",
    district: "Chaman District",
    latitude: 30.9210,
    longitude: 66.4597,
    aliases: ["chaman"],
  },
  {
    id: "dera-ismail-khan",
    name: "Dera Ismail Khan",
    province: "Khyber Pakhtunkhwa",
    district: "D.I. Khan District",
    latitude: 31.8314,
    longitude: 70.9017,
    aliases: ["dera ismail khan", "di khan", "d.i. khan"],
  },
  {
    id: "mianwali",
    name: "Mianwali",
    province: "Punjab",
    district: "Mianwali District",
    latitude: 32.5839,
    longitude: 71.5369,
    aliases: ["mianwali"],
  },
  {
    id: "bahawalpur",
    name: "Bahawalpur",
    province: "Punjab",
    district: "Bahawalpur District",
    latitude: 29.3544,
    longitude: 71.6911,
    aliases: ["bahawalpur", "bwp"],
  },
  {
    id: "sargodha",
    name: "Sargodha",
    province: "Punjab",
    district: "Sargodha District",
    latitude: 32.0836,
    longitude: 72.6711,
    aliases: ["sargodha", "sgd"],
  },
  {
    id: "kashmore",
    name: "Kashmore",
    province: "Sindh",
    district: "Kashmore District",
    latitude: 28.4310,
    longitude: 69.5847,
    aliases: ["kashmore"],
  },
  {
    id: "dera-ghazi-khan",
    name: "Dera Ghazi Khan",
    province: "Punjab",
    district: "D.G. Khan District",
    latitude: 30.0561,
    longitude: 70.6348,
    aliases: ["dera ghazi khan", "dg khan", "d.g. khan"],
  },
  {
    id: "mingora",
    name: "Mingora / Swat",
    province: "Khyber Pakhtunkhwa",
    district: "Swat District",
    latitude: 34.7717,
    longitude: 72.3602,
    aliases: ["swat", "mingora"],
  },
  {
    id: "chitral",
    name: "Chitral",
    province: "Khyber Pakhtunkhwa",
    district: "Lower Chitral District",
    latitude: 35.8510,
    longitude: 71.7869,
    aliases: ["chitral"],
  },
  {
    id: "mirpur",
    name: "Mirpur",
    province: "Azad Jammu & Kashmir",
    district: "Mirpur District",
    latitude: 33.1484,
    longitude: 73.7519,
    aliases: ["mirpur"],
  },
];

export function searchPakistanCities(query: string, limit = 8): CityLocation[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  return PAKISTAN_CITIES.filter((city) => {
    if (city.name.toLowerCase().includes(trimmed)) return true;
    if (city.district.toLowerCase().includes(trimmed)) return true;
    if (city.province.toLowerCase().includes(trimmed)) return true;
    return city.aliases.some((alias) => alias.toLowerCase().includes(trimmed));
  }).slice(0, limit);
}

export function findPakistanCity(
  name: string | null,
  district?: string | null,
  province?: string | null,
): CityLocation | null {
  const normalizedName = name?.trim().toLowerCase();
  if (!normalizedName) return null;

  return (
    PAKISTAN_CITIES.find((city) => {
      const nameMatches =
        city.name.toLowerCase() === normalizedName ||
        city.aliases.some((alias) => alias.toLowerCase() === normalizedName);
      const districtMatches = !district || city.district === district;
      const provinceMatches = !province || city.province === province;
      return nameMatches && districtMatches && provinceMatches;
    }) || null
  );
}
