function calculateScore(profile) {
    // profile contains:
    // payment_history (0-100), utilization (0-100),
    // credit_age_years (0+), credit_mix_score (0-100),
    // new_credit_inquiries (0+)
    
    let points = 0;
    
    // 1. Payment history: max 350 points (35% of 850 range)
    let payPoints = (profile.payment_history / 100) * 350;
    points += payPoints;
    
    // 2. Credit utilization: lower is better (max 300 points)
    // Ideal utilization is <=10% -> 300 points
    let utilPoints = 300 * Math.max(0, (100 - profile.utilization) / 100);
    points += utilPoints;
    
    // 3. Length of credit history: max 150 points (15%)
    // 0 years = 0 points, 25+ years = 150 points
    let agePoints = Math.min(150, profile.credit_age_years * 6);
    points += agePoints;
    
    // 4. Credit mix: max 100 points (10%)
    let mixPoints = profile.credit_mix_score; // 0-100
    points += mixPoints;
    
    // 5. New credit inquiries: each inquiry reduces points by 15, max reduction 100
    let inquiryPenalty = Math.min(100, profile.new_credit_inquiries * 15);
    let newCredPoints = 100 - inquiryPenalty;
    if (newCredPoints < 0) newCredPoints = 0;
    points += newCredPoints;
    
    // Base score is 300, then add points (max 550 possible)
    let finalScore = 300 + points;
    // Clamp between 300 and 850
    finalScore = Math.min(850, Math.max(300, Math.round(finalScore)));
    return finalScore;
  }
  
  function getRating(score) {
    if (score >= 800) return 'Exceptional';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  }
  
  module.exports = { calculateScore, getRating };