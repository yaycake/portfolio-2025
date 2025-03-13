import { useState, useEffect } from 'react';

function TypedGreeting({ onTypingComplete }) {
  const [displayText, setDisplayText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const fullText = "Hi, I'm Grace";
  
  useEffect(() => {
    let currentIndex = 0;
    const typingDelay = 100; // Adjust speed of typing
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingDone(true);
        onTypingComplete(); // Call the callback when typing is done
      }
    }, typingDelay);
    
    return () => clearInterval(typingInterval);
  }, [onTypingComplete]);
  
  return (
    <h1 className="greeting">
      {displayText}
      {!isTypingDone && <span className="cursor">|</span>}
    </h1>
  );
}

export default TypedGreeting; 