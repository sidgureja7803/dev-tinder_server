class AIService {
  constructor() {
    this.apiKey = process.env.NOVITA_AI_API_KEY;
    this.baseURL = process.env.NOVITA_AI_BASE_URL || 'https://api.novita.ai/v3/openai';
    this.model = process.env.NOVITA_AI_MODEL || 'meta-llama/llama-3.1-70b-instruct';
  }

  async generateMatchmakingInsights(userProfile, potentialMatches) {
    if (!this.apiKey) {
      console.warn('Novita AI API key not configured, using fallback insights');
      return this.getFallbackMatchmakingInsights(userProfile, potentialMatches);
    }

    try {
      const prompt = `As an AI matchmaking expert for MergeMates (a dating app for developers), analyze this user's profile and provide personalized match insights.

User Profile:
- Name: ${userProfile.firstName} ${userProfile.lastName || ''}
- Skills: ${userProfile.skills?.join(', ') || 'Not specified'}
- Profession: ${userProfile.profession || 'Not specified'}
- Education: ${userProfile.education || 'Not specified'}
- Location: ${userProfile.location || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Bio: ${userProfile.bio || 'Not provided'}

Available Matches: ${potentialMatches.length} developers in the feed

Please provide:
1. Compatibility factors that would work well for this user
2. Specific tech stack synergies to look for
3. Conversation starter suggestions
4. Profile optimization recommendations
5. What type of developers would be most compatible

Keep it concise, developer-focused, and actionable. Use a friendly, encouraging tone.`;

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 700,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || this.getFallbackMatchmakingInsights(userProfile, potentialMatches);
    } catch (error) {
      console.error('AI Matchmaking Error:', error);
      return this.getFallbackMatchmakingInsights(userProfile, potentialMatches);
    }
  }

  getFallbackMatchmakingInsights(userProfile, potentialMatches) {
    const insights = {
      compatibilityFactors: [
        "Complementary programming languages and frameworks",
        "Similar experience levels and career stages",
        "Shared interests in specific tech domains",
        "Geographic proximity for potential meetups"
      ],
      techStackSynergies: this.generateTechStackSynergies(userProfile.skills || []),
      conversationStarters: this.generateConversationStarters(userProfile),
      profileTips: this.generateProfileTips(userProfile),
      idealMatch: this.generateIdealMatchDescription(userProfile)
    };

    return `🎯 AI Matchmaking Insights for ${userProfile.firstName}

💡 Compatibility Factors:
${insights.compatibilityFactors.map(factor => `• ${factor}`).join('\n')}

🚀 Tech Stack Synergies:
${insights.techStackSynergies.map(synergy => `• ${synergy}`).join('\n')}

💬 Conversation Starters:
${insights.conversationStarters.map(starter => `• ${starter}`).join('\n')}

📈 Profile Enhancement Tips:
${insights.profileTips.map(tip => `• ${tip}`).join('\n')}

🎲 Your Ideal Match:
${insights.idealMatch}

Found ${potentialMatches.length} potential matches in your area! Start swiping to find your coding soulmate! 💕`;
  }

  generateTechStackSynergies(userSkills) {
    const synergies = [];
    
    if (userSkills.includes('React') || userSkills.includes('JavaScript')) {
      synergies.push("Frontend + Backend developers for full-stack collaboration");
    }
    
    if (userSkills.includes('Python') || userSkills.includes('Django')) {
      synergies.push("Data science and web development crossover opportunities");
    }
    
    if (userSkills.includes('Node.js') || userSkills.includes('Express')) {
      synergies.push("JavaScript ecosystem enthusiasts for shared projects");
    }
    
    if (userSkills.includes('AWS') || userSkills.includes('Docker')) {
      synergies.push("DevOps and cloud infrastructure knowledge sharing");
    }
    
    if (synergies.length === 0) {
      synergies.push("Look for developers with complementary skill sets");
      synergies.push("Consider those learning similar technologies");
    }
    
    return synergies;
  }

  generateConversationStarters(userProfile) {
    const starters = [
      "Ask about their most challenging coding project",
      "Share your favorite programming language and ask about theirs",
      "Discuss the latest tech trends or frameworks you're both interested in"
    ];

    if (userProfile.profession) {
      starters.push(`Connect over your shared experience in ${userProfile.profession}`);
    }

    if (userProfile.skills && userProfile.skills.length > 0) {
      starters.push(`Bond over your mutual interest in ${userProfile.skills[0]}`);
    }

    return starters;
  }

  generateProfileTips(userProfile) {
    const tips = [];

    if (!userProfile.bio || userProfile.bio.length < 50) {
      tips.push("Add a compelling bio showcasing your coding journey");
    }

    if (!userProfile.skills || userProfile.skills.length < 3) {
      tips.push("List more of your programming languages and technologies");
    }

    if (!userProfile.socialLinks || Object.keys(userProfile.socialLinks || {}).length < 2) {
      tips.push("Connect your GitHub, LinkedIn, and other professional profiles");
    }

    if (tips.length === 0) {
      tips.push("Your profile looks great! Keep it updated with new skills");
      tips.push("Consider adding recent projects or achievements");
    }

    return tips;
  }

  generateIdealMatchDescription(userProfile) {
    const level = userProfile.profession?.toLowerCase().includes('senior') ? 'experienced' : 'passionate';
    const domain = userProfile.skills?.includes('React') ? 'frontend' : 
                   userProfile.skills?.includes('Python') ? 'backend/data science' : 'development';
    
    return `An ${level} developer in ${domain} who shares your enthusiasm for clean code, continuous learning, and building amazing things together. Someone who can challenge you technically while sharing laughs over debugging sessions! 🚀`;
  }

  async calculateCompatibilityScore(user1, user2) {
    let score = 0;
    const factors = [];

    // Tech stack compatibility (30 points)
    const commonSkills = this.findCommonSkills(user1.skills || [], user2.skills || []);
    const skillScore = Math.min(commonSkills.length * 10, 30);
    score += skillScore;
    if (skillScore > 0) {
      factors.push(`Shared technologies: ${commonSkills.join(', ')}`);
    }

    // Experience level compatibility (20 points)
    const experienceScore = this.calculateExperienceCompatibility(user1.profession, user2.profession);
    score += experienceScore;
    if (experienceScore > 15) {
      factors.push('Similar experience levels');
    }

    // Education compatibility (15 points)
    const educationScore = this.calculateEducationCompatibility(user1.education, user2.education);
    score += educationScore;
    if (educationScore > 10) {
      factors.push('Compatible educational backgrounds');
    }

    // Age compatibility (15 points)
    const ageScore = this.calculateAgeCompatibility(user1.age, user2.age);
    score += ageScore;
    if (ageScore > 10) {
      factors.push('Age compatibility');
    }

    // Location compatibility (10 points)
    const locationScore = this.calculateLocationCompatibility(user1.location, user2.location);
    score += locationScore;
    if (locationScore > 5) {
      factors.push('Geographic proximity');
    }

    // Profile completeness bonus (10 points)
    const completenessScore = this.calculateCompletenessBonus(user1, user2);
    score += completenessScore;

    return {
      score: Math.min(score, 100),
      factors: factors.length > 0 ? factors : ['Basic compatibility factors'],
      commonSkills
    };
  }

  findCommonSkills(skills1, skills2) {
    return skills1.filter(skill => 
      skills2.some(skill2 => 
        skill.toLowerCase() === skill2.toLowerCase() ||
        skill.toLowerCase().includes(skill2.toLowerCase()) ||
        skill2.toLowerCase().includes(skill.toLowerCase())
      )
    );
  }

  calculateExperienceCompatibility(profession1, profession2) {
    if (!profession1 || !profession2) return 5;
    
    const p1Lower = profession1.toLowerCase();
    const p2Lower = profession2.toLowerCase();
    
    // Similar seniority levels
    const levels = ['junior', 'senior', 'lead', 'principal', 'staff'];
    const level1 = levels.find(level => p1Lower.includes(level));
    const level2 = levels.find(level => p2Lower.includes(level));
    
    if (level1 && level2 && level1 === level2) return 20;
    if (level1 && level2) return 15;
    
    // Similar roles
    const roles = ['developer', 'engineer', 'architect', 'designer', 'manager'];
    const role1 = roles.find(role => p1Lower.includes(role));
    const role2 = roles.find(role => p2Lower.includes(role));
    
    if (role1 && role2 && role1 === role2) return 15;
    if (role1 && role2) return 10;
    
    return 5;
  }

  calculateEducationCompatibility(education1, education2) {
    if (!education1 || !education2) return 5;
    
    const e1Lower = education1.toLowerCase();
    const e2Lower = education2.toLowerCase();
    
    // Same degree level
    if ((e1Lower.includes('bachelor') && e2Lower.includes('bachelor')) ||
        (e1Lower.includes('master') && e2Lower.includes('master')) ||
        (e1Lower.includes('phd') && e2Lower.includes('phd'))) {
      return 15;
    }
    
    // Computer Science or related fields
    const techFields = ['computer science', 'software', 'engineering', 'information technology'];
    const hasTechField1 = techFields.some(field => e1Lower.includes(field));
    const hasTechField2 = techFields.some(field => e2Lower.includes(field));
    
    if (hasTechField1 && hasTechField2) return 12;
    if (hasTechField1 || hasTechField2) return 8;
    
    return 5;
  }

  calculateAgeCompatibility(age1, age2) {
    if (!age1 || !age2) return 5;
    
    const ageDiff = Math.abs(age1 - age2);
    
    if (ageDiff <= 2) return 15;
    if (ageDiff <= 5) return 12;
    if (ageDiff <= 8) return 8;
    if (ageDiff <= 12) return 5;
    
    return 2;
  }

  calculateLocationCompatibility(location1, location2) {
    if (!location1 || !location2) return 2;
    
    const l1Lower = location1.toLowerCase();
    const l2Lower = location2.toLowerCase();
    
    // Same city
    if (l1Lower === l2Lower) return 10;
    
    // Same state/region (basic check)
    const l1Parts = l1Lower.split(',').map(part => part.trim());
    const l2Parts = l2Lower.split(',').map(part => part.trim());
    
    for (let part1 of l1Parts) {
      for (let part2 of l2Parts) {
        if (part1 === part2 && part1.length > 2) return 6;
      }
    }
    
    return 2;
  }

  calculateCompletenessBonus(user1, user2) {
    const getCompleteness = (user) => {
      let score = 0;
      if (user.bio && user.bio.length > 30) score += 2;
      if (user.skills && user.skills.length >= 3) score += 2;
      if (user.socialLinks && Object.keys(user.socialLinks).length >= 2) score += 2;
      if (user.photos && user.photos.length >= 2) score += 2;
      if (user.profession) score += 1;
      if (user.education) score += 1;
      return score;
    };
    
    const completeness1 = getCompleteness(user1);
    const completeness2 = getCompleteness(user2);
    
    return Math.min(completeness1 + completeness2, 10);
  }
}

module.exports = new AIService(); 