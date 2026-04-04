/**
 * 角色形象管理工具
 * 管理玩家的角色形象选择和存储
 */

// 所有角色形象配置
export const characterAvatars = {
  male: [
    {
      id: 'male_mage',
      name: '法师',
      nameEn: 'Mage',
      gender: 'male',
      genderCn: '男',
      description: '掌握奥术力量的神秘施法者',
      primaryColor: '#9775fa',
      secondaryColor: '#7048e8',
      accentColor: '#d0bfff',
      bgColor: 'linear-gradient(135deg, #9775fa 0%, #7048e8 100%)',
      icon: 'mage',
      image: '/avatars/male_mage.png'
    },
    {
      id: 'male_knight',
      name: '骑士',
      nameEn: 'Knight',
      gender: 'male',
      genderCn: '男',
      description: '身披重甲的正义守护者',
      primaryColor: '#4dabf7',
      secondaryColor: '#1971c2',
      accentColor: '#a5d8ff',
      bgColor: 'linear-gradient(135deg, #4dabf7 0%, #1971c2 100%)',
      icon: 'knight',
      image: '/avatars/male_knight.png'
    },
    {
      id: 'male_reader',
      name: '阅读者',
      nameEn: 'Reader',
      gender: 'male',
      genderCn: '男',
      description: '追寻知识的博学智者',
      primaryColor: '#20c997',
      secondaryColor: '#0ca678',
      accentColor: '#96f2d7',
      bgColor: 'linear-gradient(135deg, #20c997 0%, #0ca678 100%)',
      icon: 'reader',
      image: '/avatars/male_reader.png'
    },
    {
      id: 'male_thief',
      name: '盗贼',
      nameEn: 'Thief',
      gender: 'male',
      genderCn: '男',
      description: '来去无踪的暗影行者',
      primaryColor: '#868e96',
      secondaryColor: '#495057',
      accentColor: '#adb5bd',
      bgColor: 'linear-gradient(135deg, #868e96 0%, #495057 100%)',
      icon: 'thief',
      image: '/avatars/male_thief.png'
    },
    {
      id: 'male_archer',
      name: '弓箭手',
      nameEn: 'Archer',
      gender: 'male',
      genderCn: '男',
      description: '百步穿杨的精准射手',
      primaryColor: '#fab005',
      secondaryColor: '#e67700',
      accentColor: '#ffe066',
      bgColor: 'linear-gradient(135deg, #fab005 0%, #e67700 100%)',
      icon: 'archer',
      image: '/avatars/male_archer.png'
    }
  ],
  female: [
    {
      id: 'female_mage',
      name: '法师',
      nameEn: 'Mage',
      gender: 'female',
      genderCn: '女',
      description: '掌控奥术的优雅施法者',
      primaryColor: '#da77f2',
      secondaryColor: '#be4bdb',
      accentColor: '#eebefa',
      bgColor: 'linear-gradient(135deg, #da77f2 0%, #be4bdb 100%)',
      icon: 'mage',
      image: '/avatars/female_mage.png'
    },
    {
      id: 'female_knight',
      name: '骑士',
      nameEn: 'Knight',
      gender: 'female',
      genderCn: '女',
      description: '银甲闪耀的英勇战士',
      primaryColor: '#74c0fc',
      secondaryColor: '#339af0',
      accentColor: '#d0ebff',
      bgColor: 'linear-gradient(135deg, #74c0fc 0%, #339af0 100%)',
      icon: 'knight',
      image: '/avatars/female_knight.png'
    },
    {
      id: 'female_reader',
      name: '阅读者',
      nameEn: 'Reader',
      gender: 'female',
      genderCn: '女',
      description: '博览群书的智慧学者',
      primaryColor: '#38d9a9',
      secondaryColor: '#12b886',
      accentColor: '#b2f2bb',
      bgColor: 'linear-gradient(135deg, #38d9a9 0%, #12b886 100%)',
      icon: 'reader',
      image: '/avatars/female_reader.png'
    },
    {
      id: 'female_thief',
      name: '盗贼',
      nameEn: 'Thief',
      gender: 'female',
      genderCn: '女',
      description: '敏捷灵动的暗夜行者',
      primaryColor: '#adb5bd',
      secondaryColor: '#868e96',
      accentColor: '#dee2e6',
      bgColor: 'linear-gradient(135deg, #adb5bd 0%, #868e96 100%)',
      icon: 'thief',
      image: '/avatars/female_thief.png'
    },
    {
      id: 'female_archer',
      name: '弓箭手',
      nameEn: 'Archer',
      gender: 'female',
      genderCn: '女',
      description: '箭无虚发的森林猎手',
      primaryColor: '#fcc419',
      secondaryColor: '#e67700',
      accentColor: '#ffec99',
      bgColor: 'linear-gradient(135deg, #fcc419 0%, #e67700 100%)',
      icon: 'archer',
      image: '/avatars/female_archer.png'
    }
  ]
}

// 获取所有角色列表（扁平化）
export const getAllAvatars = () => {
  return [...characterAvatars.male, ...characterAvatars.female]
}

// 根据ID获取角色信息
export const getAvatarById = (id) => {
  const all = getAllAvatars()
  return all.find(avatar => avatar.id === id) || null
}

// 随机获取一个角色
export const getRandomAvatar = () => {
  const all = getAllAvatars()
  const randomIndex = Math.floor(Math.random() * all.length)
  return all[randomIndex]
}

// 存储键名
const STORAGE_KEY = 'selected_avatar'

// 获取用户选中的形象
export const getSelectedAvatar = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const avatar = getAvatarById(stored)
      if (avatar) return avatar
    }
  } catch (e) {
    console.warn('读取存储的形象失败:', e)
  }
  
  // 没有存储或存储无效，随机分配一个
  const randomAvatar = getRandomAvatar()
  saveSelectedAvatar(randomAvatar.id)
  return randomAvatar
}

// 保存用户选中的形象
export const saveSelectedAvatar = (avatarId) => {
  try {
    localStorage.setItem(STORAGE_KEY, avatarId)
    return true
  } catch (e) {
    console.warn('保存形象失败:', e)
    return false
  }
}

// 获取默认形象（用于显示"未选择"状态）
export const getDefaultAvatar = () => {
  return {
    id: 'default',
    name: '神秘人',
    nameEn: 'Mysterious',
    gender: 'unknown',
    genderCn: '未知',
    description: '尚未选择角色形象',
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    accentColor: '#a8b4ff',
    bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    icon: 'default',
    image: null
  }
}

export default {
  characterAvatars,
  getAllAvatars,
  getAvatarById,
  getRandomAvatar,
  getSelectedAvatar,
  saveSelectedAvatar,
  getDefaultAvatar
}