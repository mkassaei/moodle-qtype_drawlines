@qtype @qtype_drawlines
Feature: Test exporting DrawLines questions
  As a teacher
  In order to be able to reuse my DrawLines questions
  I need to export them

  Background:
    Given the following "users" exist:
      | username |
      | teacher  |
    And the following "courses" exist:
      | fullname | shortname | category |
      | Course 1 | C1        | 0        |
    And the following "course enrolments" exist:
      | user    | course | role           |
      | teacher | C1     | editingteacher |
    And the following "question categories" exist:
      | contextlevel | reference | name           |
      | Course       | C1        | Test questions |
    And the following "questions" exist:
      | questioncategory | qtype     | name         | template       |
      | Test questions   | drawlines | Drawlines 01 | mkmap_twolines |

  @javascript
  Scenario: Export a DrawLines question
    When I am on the "Course 1" "core_question > course question export" page logged in as teacher
    And I set the field "id_format_xml" to "1"
    And I press "Export questions to file"
    Then following "click here" should download a file that:
      | Has mimetype                 | text/xml     |
      | Contains text in xml element | Drawlines 01 |
    # If the download step is the last in the scenario then we can sometimes run
    # into the situation where the download page causes a http redirect but behat
    # has already conducted its reset (generating an error). By putting a logout
    # step we avoid behat doing the reset until we are off that page.
    And I log out
