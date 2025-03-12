import { useState, useEffect } from 'react';

function SecondGreeting({ show, onTypingComplete }) {
  const [displayText, setDisplayText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const fullText = "I'm a product designer who vibe codes.\nNice to meet you! What do you do?";
  
  useEffect(() => {
    if (!show) return;
    
    let currentIndex = 0;
    const typingDelay = 100;
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingDone(true);
        onTypingComplete?.();
      }
    }, typingDelay);
    
    return () => clearInterval(typingInterval);
  }, [show, onTypingComplete]);
  
  if (!show) return null;
  
  return (
    <h1 className="greeting second-greeting">
      {displayText}
      {!isTypingDone && <span className="cursor">|</span>}
    </h1>
  );
}

export default SecondGreeting; 