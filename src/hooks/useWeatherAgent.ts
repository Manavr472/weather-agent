import { useState, useEffect, useRef } from "react";

interface UseWeatherAgentParams {
  messageHistory: { sender: string; text: string }[];
  threadId: string;
  apiUrl: string;
}

const useWeatherAgent = ({ messageHistory, threadId, apiUrl }: UseWeatherAgentParams) => {
  const [responseChunks, setResponseChunks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Parse the streaming response format
  const parseStreamChunk = (chunk: string) => {      try {
      // The response comes in lines, each potentially containing multiple parts
      const lines = chunk.trim().split('\n');
      
      let extractedText = '';
      
      for (const line of lines) {
        // Extract content parts that contain 0:" pattern (message content)
        const regex = /0:"([^"\\]*(\\.[^"\\]*)*)"/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
          
          // Extract the content between quotes and handle escaped characters
          if (match[1]) {
            // Replace raw \\n with actual newlines for markdown
            let content = match[1].replace(/\\n/g, '\n');
            extractedText += content;
          }
        }
      }
      
      return extractedText;
    } catch (err) {
      return chunk; // Return the original chunk if parsing fails
    }
  };

  // Enhanced function to prepare the initial message if there's no conversation yet
  const prepareInitialMessage = (userInput: string) => {
    // Detect if the input seems to be a greeting
    const isGreeting = /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)( there)?[!.?]?$/i.test(userInput);

    if (isGreeting) {
      return {
        role: "user",
        content: `${userInput} I'd like to get some weather information.`
      };
    }
    
    // Detect if this seems like a simple location/city name
    const seemsLikeLocation = /^[A-Za-z\s\-',.]+$/.test(userInput) && 
                             userInput.split(/\s+/).length <= 3 &&
                             !/^\d+$/.test(userInput);  // Not just numbers
                             
    if (seemsLikeLocation) {
      return {
        role: "user",
        content: `What's the weather in ${userInput}?`
      };
    }
    
    // Use original input if it seems to already be a question
    return {
      role: "user",
      content: userInput
    };
  };

  const sendRequest = async (customMessages: { sender: string; text: string }[] | null = null) => {
    setLoading(true);
    setError(null);
    setResponseChunks([]);

    abortControllerRef.current = new AbortController();

    try {
      // Use custom messages if provided, otherwise use message history
      const messagesToSend = customMessages || messageHistory;
      
      // Format messages according to the API specification
      // Make sure we're only sending relevant messages (user and agent)
      // and correctly format them for the API
      const formattedMessages = messagesToSend
        .filter(msg => msg.sender === "user" || msg.sender === "agent")
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        }));

      // Ensure the conversation has at least one message
      if (formattedMessages.length === 0) {
        formattedMessages.push({
          role: "user",
          content: "Hello, can you help me with weather information?"
        });
      }
      
      // If this is the first user message, enhance it with context
      if (formattedMessages.length === 1 && formattedMessages[0].role === "user") {
        const enhancedMessage = prepareInitialMessage(formattedMessages[0].content);
        formattedMessages[0] = enhancedMessage;
      }

      const requestBody = {
        messages: formattedMessages,
        runId: "weatherAgent",
        maxRetries: 2,
        maxSteps: 5,
        temperature: 0.5,
        topP: 1,
        runtimeContext: {},
        threadId,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          'Accept': '*/*',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,fr;q=0.7',
          'Connection': 'keep-alive',
          'Content-Type': 'application/json',
          'x-mastra-dev-playground': 'true'
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error response:", errorText);
        throw new Error(`API error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullMessage = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value);
        const parsedChunk = parseStreamChunk(chunk);
        
        if (parsedChunk.trim()) {
          // Preserve markdown formatting in the response
          fullMessage += parsedChunk;
          
          // Process any escaped characters for markdown display
          const processedMessage = fullMessage.replace(/\\n/g, '\n')
                                            .replace(/\\\*/g, '*')
                                            .replace(/\\\*/g, '*')
                                            .replace(/\\_/g, '_');
          
          // Set the processed message
          setResponseChunks([processedMessage]);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Request aborted");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const abortRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  useEffect(() => {
    return () => {
      abortRequest();
    };
  }, []);

  return { responseChunks, loading, error, sendRequest, abortRequest };
};

export default useWeatherAgent;
