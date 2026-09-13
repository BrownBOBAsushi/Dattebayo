export function randomNinjaName() {
  const first = ['Gentle','Silent','Mecha','Swift','Hidden','Brave','Golden','Misty','Cosmic','Crimson','Lucky','Thunder'];
  const second = ['Rainbow','Armadillo','Sonic','Fox','Falcon','Panda','Lotus','Tiger','Otter','Dragon','Owl','Raven'];
  const numbers = crypto.getRandomValues(new Uint32Array(2));
  return `${first[numbers[0] % first.length]} ${second[numbers[1] % second.length]}`;
}
