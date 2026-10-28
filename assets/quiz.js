// Reusable interactive quiz component for System Design lessons
function initQuizzes() {
  document.querySelectorAll('.quiz-container').forEach((container) => {
    const options = container.querySelectorAll('.quiz-option');
    const feedback = container.querySelector('.quiz-feedback');
    let answered = false;

    options.forEach((option) => {
      option.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const isCorrect = option.dataset.correct === 'true';
        const explanation = option.dataset.explanation || (isCorrect ? 'Correct!' : 'Incorrect.');

        if (isCorrect) {
          option.classList.add('correct');
          feedback.className = 'quiz-feedback show feedback-correct';
          feedback.innerHTML = `<strong>Correct:</strong> ${explanation}`;
        } else {
          option.classList.add('incorrect');
          feedback.className = 'quiz-feedback show feedback-incorrect';
          feedback.innerHTML = `<strong>Incorrect:</strong> ${explanation}`;
          
          // Also highlight correct answer
          options.forEach(opt => {
            if (opt.dataset.correct === 'true') {
              opt.classList.add('correct');
            }
          });
        }
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', initQuizzes);
