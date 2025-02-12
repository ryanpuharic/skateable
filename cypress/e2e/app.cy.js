// cypress/e2e/app.spec.js
describe('Skateable App', () => {
  beforeEach(() => {
    cy.visit('https://www.skateable.app/'); 
  });

  it('should load the map', () => {
    cy.get('#map').should('exist');
  });

  it('should search for a location', () => {
    cy.get('#search-input').type('New York');
    cy.get('#search-button').click();
    cy.get('#map').should('exist');
  });

  it('should handle login', () => {
    cy.login('rep', 'rep');
    cy.get('#logged-in-user').should('have.text', 'rep');
  });

  it('should handle logout', () => {
    cy.get('#login-btn').should('be.visible').click();
  });


});