const ADJECTIVES = [
  '潜伏', '神秘', '夜行', '隐形', '机智', '孤独', '王牌', '新手', '资深', '退役',
  '迷糊', '暴躁', '冷静', '疯狂', '忧郁', '快乐', '沉默', '话痨', '天才', '废柴'
];

const NOUNS = [
  '侦探', '特工', '卧底', '情报员', '线人', '黑客', '信使', '观察者', '记录员', '影子',
  '猫咪', '仓鼠', '夜鹰', '孤狼', '幽灵', '幻影', '路人', '咸鱼', '摸鱼王', '社畜'
];

export const generateRandomName = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}的${noun}#${num}`;
};
